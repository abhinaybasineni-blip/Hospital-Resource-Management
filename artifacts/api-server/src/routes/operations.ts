import { Router, type IRouter } from "express";
import {
  GetDashboardResponse,
  ListAlertsQueryParams,
  ListAlertsResponse,
  ListHistoryQueryParams,
  ListHistoryResponse,
  MarkAlertReadBody,
  MarkAlertReadParams,
  MarkAlertReadResponse,
} from "@workspace/api-zod";
import { withUserTransaction } from "../database";
import { currentUser, requireAuth } from "../middlewares/auth";
import {
  alertToApi,
  getAllResources,
  resourceCounts,
  resourceTypeSchema,
  syncAlerts,
  type ResourceType,
} from "../lib/resources";

const router: IRouter = Router();

function iso(value: unknown): string {
  return value instanceof Date
    ? value.toISOString()
    : new Date(String(value)).toISOString();
}

function historyToApi(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    resourceType: row.resource_type,
    resourceId: String(row.resource_id),
    actorName: String(row.actor_name),
    action: row.action,
    previousData: row.previous_data ?? null,
    newData: row.new_data ?? null,
    createdAt: iso(row.created_at),
  };
}

router.get("/dashboard", requireAuth, async (req, res) => {
  const user = currentUser(req);
  const dashboard = await withUserTransaction(user.id, async (client) => {
    const resources = await getAllResources(client);
    const alerts = await syncAlerts(client, user.id, resources);
    const history = await client.query(
      `select id, resource_type, resource_id, actor_name, action,
              previous_data, new_data, created_at
       from public.resource_history
       order by created_at desc
       limit 6`,
    );
    const byType = (type: ResourceType) =>
      resources.filter((resource) => resource.resourceType === type);
    return {
      hospitalName: user.hospitalName,
      resources: {
        icuBeds: resourceCounts("icu-beds", byType("icu-beds")),
        oxygen: resourceCounts("oxygen", byType("oxygen")),
        ventilators: resourceCounts("ventilators", byType("ventilators")),
        medicines: resourceCounts("medicines", byType("medicines")),
        blood: resourceCounts("blood", byType("blood")),
      },
      activeAlerts: alerts.length,
      recentActivity: history.rows.map(historyToApi),
    };
  });
  res.json(GetDashboardResponse.parse(dashboard));
});

router.get("/history", requireAuth, async (req, res) => {
  const input = ListHistoryQueryParams.parse(req.query);
  const user = currentUser(req);
  const page = Math.max(Number(input.page) || 1, 1);
  const limit = Math.min(Math.max(Number(input.limit) || 30, 1), 100);
  const conditions: string[] = [];
  const values: unknown[] = [];
  const addValue = (value: unknown) => {
    values.push(value);
    return `$${values.length}`;
  };
  if (input.resourceType) {
    conditions.push(`resource_type = ${addValue(input.resourceType)}`);
  }
  if (input.from) {
    conditions.push(`created_at >= ${addValue(input.from)}::date`);
  }
  if (input.to) {
    conditions.push(`created_at < (${addValue(input.to)}::date + interval '1 day')`);
  }
  if (input.q?.trim()) {
    const placeholder = addValue(`%${input.q.trim()}%`);
    conditions.push(
      `(actor_name ilike ${placeholder} or action ilike ${placeholder} or resource_type ilike ${placeholder} or resource_id::text ilike ${placeholder})`,
    );
  }
  const where = conditions.length ? ` where ${conditions.join(" and ")}` : "";
  const history = await withUserTransaction(user.id, async (client) => {
    const countResult = await client.query(
      `select count(*)::int as total from public.resource_history${where}`,
      values,
    );
    const pagedValues = [...values, limit, (page - 1) * limit];
    const rows = await client.query(
      `select id, resource_type, resource_id, actor_name, action,
              previous_data, new_data, created_at
       from public.resource_history${where}
       order by created_at desc
       limit $${pagedValues.length - 1} offset $${pagedValues.length}`,
      pagedValues,
    );
    return {
      items: rows.rows.map(historyToApi),
      page,
      limit,
      total: Number(countResult.rows[0]?.total ?? 0),
    };
  });
  res.json(ListHistoryResponse.parse(history));
});

router.get("/alerts", requireAuth, async (req, res) => {
  const input = ListAlertsQueryParams.parse(req.query);
  const user = currentUser(req);
  const rows = await withUserTransaction(user.id, async (client) => {
    const resources = await getAllResources(client);
    return syncAlerts(client, user.id, resources);
  });
  const alerts = rows.map(alertToApi);
  res.json(
    ListAlertsResponse.parse(
      input.unreadOnly ? alerts.filter((alert) => !alert.isRead) : alerts,
    ),
  );
});

router.patch("/alerts/:id/read", requireAuth, async (req, res) => {
  const { id } = MarkAlertReadParams.parse(req.params);
  const input = MarkAlertReadBody.parse(req.body);
  const user = currentUser(req);
  const row = await withUserTransaction(user.id, async (client) => {
    const result = await client.query(
      `update public.alerts set is_read = $1, updated_at = now()
       where id = $2 and is_active = true
       returning id, resource_type, resource_id, severity, title, message, is_read, created_at`,
      [input.isRead, id],
    );
    return result.rows[0] as Record<string, unknown> | undefined;
  });
  if (!row) {
    res.status(404).json({ error: "Alert not found." });
    return;
  }
  res.json(MarkAlertReadResponse.parse(alertToApi(row)));
});

export default router;
