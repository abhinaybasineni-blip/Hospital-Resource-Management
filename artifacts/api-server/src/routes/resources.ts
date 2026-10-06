import { Router, type IRouter } from "express";
import {
  CreateResourceBody,
  CreateResourceResponse,
  CreateResourceParams,
  DeleteResourceParams,
  GetResourceParams,
  GetResourceResponse,
  ListResourcesParams,
  ListResourcesQueryParams,
  ListResourcesResponse,
  RestoreResourceParams,
  RestoreResourceResponse,
  UpdateResourceBody,
  UpdateResourceParams,
  UpdateResourceResponse,
} from "@workspace/api-zod";
import { withUserTransaction } from "../database";
import { currentUser, requireAuth, requireManager } from "../middlewares/auth";
import {
  insertResource,
  listResourceRecords,
  resourceDefinitions,
  resourceTypeSchema,
  rowToResource,
  updateResource,
  type ResourceType,
} from "../lib/resources";

const router: IRouter = Router();

async function appendHistory(
  client: import("pg").PoolClient,
  user: NonNullable<Express.Request["user"]>,
  resourceType: ResourceType,
  resourceId: string,
  action: "CREATE" | "UPDATE" | "DELETE" | "ARCHIVE" | "RESTORE",
  previousData: Record<string, unknown> | null,
  newData: Record<string, unknown> | null,
): Promise<void> {
  await client.query(
    `insert into public.resource_history
      (user_id, actor_name, resource_type, resource_id, action, previous_data, new_data)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [user.id, user.name, resourceType, resourceId, action, previousData, newData],
  );
}

router.get("/resources/:resourceType", requireAuth, async (req, res) => {
  const { resourceType } = ListResourcesParams.parse(req.params);
  const query = ListResourcesQueryParams.parse(req.query);
  const user = currentUser(req);
  const page = await withUserTransaction(user.id, (client) =>
    listResourceRecords(client, resourceType as ResourceType, {
      q: query.q,
      status: query.status,
      location: query.location,
      category: query.category,
      bloodGroup: query.bloodGroup,
      expiry: query.expiry,
      includeArchived: query.includeArchived,
      sort: query.sort,
      direction: query.direction,
      page: Number(query.page),
      limit: Number(query.limit),
    }),
  );
  res.json(ListResourcesResponse.parse(page));
});

router.post(
  "/resources/:resourceType",
  requireAuth,
  requireManager,
  async (req, res) => {
    const { resourceType } = CreateResourceParams.parse(req.params);
    const input = CreateResourceBody.parse(req.body);
    const user = currentUser(req);
    const created = await withUserTransaction(user.id, async (client) => {
      const record = await insertResource(
        client,
        user.id,
        resourceType as ResourceType,
        input.data,
      );
      await appendHistory(
        client,
        user,
        resourceType as ResourceType,
        record.id,
        "CREATE",
        null,
        record.data,
      );
      return record;
    });
    res.status(201).json(CreateResourceResponse.parse(created));
  },
);

router.get(
  "/resources/:resourceType/:id",
  requireAuth,
  async (req, res) => {
    const { resourceType, id } = GetResourceParams.parse(req.params);
    const user = currentUser(req);
    const record = await withUserTransaction(user.id, async (client) => {
      const definition = resourceDefinitions[resourceType as ResourceType];
      const result = await client.query(
        `select * from public.${definition.table} where id = $1 and archived_at is null`,
        [id],
      );
      return result.rows[0]
        ? rowToResource(resourceType as ResourceType, result.rows[0])
        : null;
    });
    if (!record) {
      res.status(404).json({ error: "Resource not found." });
      return;
    }
    res.json(GetResourceResponse.parse(record));
  },
);

router.put(
  "/resources/:resourceType/:id",
  requireAuth,
  requireManager,
  async (req, res) => {
    const { resourceType, id } = UpdateResourceParams.parse(req.params);
    const input = UpdateResourceBody.parse(req.body);
    const user = currentUser(req);
    const record = await withUserTransaction(user.id, async (client) => {
      const definition = resourceDefinitions[resourceType as ResourceType];
      const previousResult = await client.query(
        `select * from public.${definition.table} where id = $1 and archived_at is null`,
        [id],
      );
      if (!previousResult.rows[0]) return null;
      const previous = rowToResource(
        resourceType as ResourceType,
        previousResult.rows[0],
      );
      const updated = await updateResource(
        client,
        resourceType as ResourceType,
        id,
        input.data,
      );
      if (!updated) return null;
      await appendHistory(
        client,
        user,
        resourceType as ResourceType,
        id,
        "UPDATE",
        previous.data,
        updated.data,
      );
      return updated;
    });
    if (!record) {
      res.status(404).json({ error: "Resource not found." });
      return;
    }
    res.json(UpdateResourceResponse.parse(record));
  },
);

router.delete(
  "/resources/:resourceType/:id",
  requireAuth,
  requireManager,
  async (req, res) => {
    const { resourceType, id } = DeleteResourceParams.parse(req.params);
    const user = currentUser(req);
    const archived = await withUserTransaction(user.id, async (client) => {
      const definition = resourceDefinitions[resourceType as ResourceType];
      const result = await client.query(
        `update public.${definition.table}
         set archived_at = now(), updated_at = now()
         where id = $1 and archived_at is null returning *`,
        [id],
      );
      if (!result.rows[0]) return false;
      const record = rowToResource(
        resourceType as ResourceType,
        result.rows[0],
      );
      await appendHistory(
        client,
        user,
        resourceType as ResourceType,
        id,
        "ARCHIVE",
        record.data,
        null,
      );
      return true;
    });
    if (!archived) {
      res.status(404).json({ error: "Resource not found." });
      return;
    }
    res.status(204).send();
  },
);

router.post(
  "/resources/:resourceType/:id/restore",
  requireAuth,
  requireManager,
  async (req, res) => {
    const { resourceType, id } = RestoreResourceParams.parse(req.params);
    const user = currentUser(req);
    const restored = await withUserTransaction(user.id, async (client) => {
      const definition = resourceDefinitions[resourceType as ResourceType];
      const result = await client.query(
        `update public.${definition.table}
         set archived_at = null, updated_at = now()
         where id = $1 and archived_at is not null returning *`,
        [id],
      );
      if (!result.rows[0]) return null;
      const record = rowToResource(
        resourceType as ResourceType,
        result.rows[0],
      );
      await appendHistory(
        client,
        user,
        resourceType as ResourceType,
        id,
        "RESTORE",
        null,
        record.data,
      );
      return record;
    });
    if (!restored) {
      res.status(404).json({ error: "Archived resource not found." });
      return;
    }
    res.json(RestoreResourceResponse.parse(restored));
  },
);

export default router;
