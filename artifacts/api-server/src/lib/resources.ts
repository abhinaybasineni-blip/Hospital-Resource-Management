import { z } from "zod/v4";
import type { PoolClient } from "pg";

export const resourceTypeSchema = z.enum([
  "icu-beds",
  "oxygen",
  "ventilators",
  "medicines",
  "blood",
]);
export type ResourceType = z.infer<typeof resourceTypeSchema>;

type ResourceDefinition = {
  table: string;
  columns: Record<string, string>;
  searchColumns: string[];
  sortableColumns: Record<string, string>;
  locationColumn?: string;
  categoryColumn?: string;
  bloodGroupColumn?: string;
  expiryColumn?: string;
};

export const resourceDefinitions: Record<ResourceType, ResourceDefinition> = {
  "icu-beds": {
    table: "icu_beds",
    columns: {
      bedId: "bed_id",
      ward: "ward",
      status: "status",
      patientId: "patient_id",
      notes: "notes",
    },
    searchColumns: ["bed_id", "ward", "patient_id", "notes"],
    sortableColumns: {
      bedId: "bed_id",
      ward: "ward",
      status: "status",
      updatedAt: "updated_at",
    },
    locationColumn: "ward",
  },
  oxygen: {
    table: "oxygen_equipment",
    columns: {
      name: "name",
      type: "equipment_type",
      location: "location",
      status: "status",
      quantity: "quantity",
      lastServiced: "last_serviced",
    },
    searchColumns: ["name", "equipment_type", "location"],
    sortableColumns: {
      name: "name",
      type: "equipment_type",
      status: "status",
      quantity: "quantity",
      location: "location",
      updatedAt: "updated_at",
    },
    locationColumn: "location",
    categoryColumn: "equipment_type",
  },
  ventilators: {
    table: "ventilators",
    columns: {
      name: "name",
      assetId: "asset_id",
      location: "location",
      status: "status",
      lastServiced: "last_serviced",
    },
    searchColumns: ["name", "asset_id", "location"],
    sortableColumns: {
      name: "name",
      assetId: "asset_id",
      status: "status",
      location: "location",
      updatedAt: "updated_at",
    },
    locationColumn: "location",
  },
  medicines: {
    table: "medicines",
    columns: {
      name: "name",
      category: "category",
      quantity: "quantity",
      unit: "unit",
      reorderLevel: "reorder_level",
      expiryDate: "expiry_date",
      location: "location",
    },
    searchColumns: ["name", "category", "location"],
    sortableColumns: {
      name: "name",
      category: "category",
      quantity: "quantity",
      reorderLevel: "reorder_level",
      expiryDate: "expiry_date",
      location: "location",
      updatedAt: "updated_at",
    },
    locationColumn: "location",
    categoryColumn: "category",
    expiryColumn: "expiry_date",
  },
  blood: {
    table: "blood_units",
    columns: {
      bloodGroup: "blood_group",
      quantity: "quantity",
      expiryDate: "expiry_date",
      location: "location",
      status: "status",
    },
    searchColumns: ["blood_group", "location"],
    sortableColumns: {
      bloodGroup: "blood_group",
      quantity: "quantity",
      expiryDate: "expiry_date",
      location: "location",
      status: "status",
      updatedAt: "updated_at",
    },
    locationColumn: "location",
    bloodGroupColumn: "blood_group",
    expiryColumn: "expiry_date",
  },
};

const nonNegativeInt = z.coerce.number().int().min(0);
const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date.")
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)), "Enter a valid date.");

const resourceDataSchemas: Record<ResourceType, z.ZodType<Record<string, unknown>>> = {
  "icu-beds": z
    .object({
      bedId: z.string().trim().min(1).max(80),
      ward: z.string().trim().min(1).max(120),
      status: z.enum(["available", "occupied", "maintenance", "critical"]),
      patientId: z.string().trim().max(120).optional(),
      notes: z.string().trim().max(500).optional(),
    })
    .transform((data) => data as Record<string, unknown>),
  oxygen: z
    .object({
      name: z.string().trim().min(1).max(140),
      type: z.string().trim().min(1).max(100),
      location: z.string().trim().min(1).max(160),
      status: z.enum(["available", "in-use", "maintenance", "critical"]),
      quantity: nonNegativeInt.default(1),
      lastServiced: dateOnly.optional(),
    })
    .transform((data) => data as Record<string, unknown>),
  ventilators: z
    .object({
      name: z.string().trim().min(1).max(140),
      assetId: z.string().trim().min(1).max(100),
      location: z.string().trim().min(1).max(160),
      status: z.enum(["available", "in-use", "maintenance", "critical"]),
      lastServiced: dateOnly.optional(),
    })
    .transform((data) => data as Record<string, unknown>),
  medicines: z
    .object({
      name: z.string().trim().min(1).max(160),
      category: z.string().trim().min(1).max(100),
      quantity: nonNegativeInt,
      unit: z.string().trim().min(1).max(40),
      reorderLevel: nonNegativeInt.default(0),
      expiryDate: dateOnly,
      location: z.string().trim().min(1).max(160),
    })
    .transform((data) => data as Record<string, unknown>),
  blood: z
    .object({
      bloodGroup: z.enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]),
      quantity: nonNegativeInt,
      expiryDate: dateOnly,
      location: z.string().trim().min(1).max(160),
      status: z.enum(["available", "reserved", "critical"]).default("available"),
    })
    .transform((data) => data as Record<string, unknown>),
};

export class ResourceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResourceValidationError";
  }
}

export type ResourceRecord = {
  id: string;
  resourceType: ResourceType;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};

export type ResourceQuery = {
  q?: string;
  status?: string;
  location?: string;
  category?: string;
  bloodGroup?: string;
  expiry?: "any" | "soon" | "expired";
  includeArchived?: boolean;
  sort?: string;
  direction?: "asc" | "desc";
  page?: number;
  limit?: number;
};

export type AlertDraft = {
  fingerprint: string;
  resourceType: ResourceType;
  resourceId: string;
  severity: "WARNING" | "HIGH" | "CRITICAL";
  title: string;
  message: string;
};

export function validateResourceData(
  type: ResourceType,
  value: unknown,
): Record<string, unknown> {
  const parsed = resourceDataSchemas[type].safeParse(value);
  if (!parsed.success) {
    throw new ResourceValidationError(
      parsed.error.issues.map((issue) => issue.message).join(" "),
    );
  }
  const data = parsed.data;
  return data;
}

function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return new Date(String(value)).toISOString();
}

function expiryDays(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const expiry = Date.parse(`${value.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(expiry)) return null;
  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.floor((expiry - todayUtc) / 86_400_000);
}

export function resourceStatus(
  type: ResourceType,
  data: Record<string, unknown>,
): string {
  if (type === "medicines") {
    const days = expiryDays(data.expiryDate);
    if (days !== null && days < 0) return "expired";
    if (days !== null && days <= 7) return "warning";
    if (days !== null && days <= 30) return "warning";
    const quantity = Number(data.quantity ?? 0);
    const reorder = Number(data.reorderLevel ?? 0);
    if (quantity === 0 || (reorder > 0 && quantity <= reorder * 0.5)) return "critical";
    if (quantity <= reorder) return "warning";
    return "available";
  }
  if (type === "blood") {
    const days = expiryDays(data.expiryDate);
    if (days !== null && days < 0) return "expired";
    if (days !== null && days <= 7) return "warning";
    if (data.status === "critical" || Number(data.quantity ?? 0) <= 2) return "critical";
    if (data.status === "reserved" || Number(data.quantity ?? 0) <= 5) return "reserved";
    return "available";
  }
  return String(data.status ?? "available");
}

export function rowToResource(type: ResourceType, row: Record<string, unknown>): ResourceRecord {
  const data: Record<string, unknown> = {};
  for (const [field, column] of Object.entries(resourceDefinitions[type].columns)) {
    data[field] = row[column];
  }
  if (type === "oxygen" || type === "ventilators") {
    data.lastServiced = row.last_serviced == null ? null : String(row.last_serviced).slice(0, 10);
  }
  if (type === "medicines" || type === "blood") {
    data.expiryDate = String(row.expiry_date).slice(0, 10);
  }
  data.status = resourceStatus(type, data);
  return {
    id: String(row.id),
    resourceType: type,
    data,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    archivedAt: row.archived_at == null ? null : iso(row.archived_at),
  };
}

export async function getAllResources(
  client: PoolClient,
  includeArchived = false,
): Promise<ResourceRecord[]> {
  const results: ResourceRecord[] = [];
  for (const type of resourceTypeSchema.options) {
    const definition = resourceDefinitions[type];
    const result = await client.query(
      `select * from public.${definition.table}${includeArchived ? "" : " where archived_at is null"} order by updated_at desc`,
    );
    results.push(...result.rows.map((row: Record<string, unknown>) => rowToResource(type, row)));
  }
  return results;
}

export async function listResourceRecords(
  client: PoolClient,
  type: ResourceType,
  query: ResourceQuery,
): Promise<{ items: ResourceRecord[]; page: number; limit: number; total: number }> {
  const definition = resourceDefinitions[type];
  const conditions: string[] = [];
  const values: unknown[] = [];
  const addValue = (value: unknown): string => {
    values.push(value);
    return `$${values.length}`;
  };
  if (!query.includeArchived) conditions.push("archived_at is null");
  const search = query.q?.trim();
  if (search) {
    const placeholder = addValue(`%${search}%`);
    conditions.push(`(${definition.searchColumns.map((column) => `${column} ilike ${placeholder}`).join(" or ")})`);
  }
  if (query.location?.trim() && definition.locationColumn) {
    conditions.push(`${definition.locationColumn} ilike ${addValue(`%${query.location.trim()}%`)}`);
  }
  if (query.category?.trim() && definition.categoryColumn) {
    conditions.push(`${definition.categoryColumn} = ${addValue(query.category.trim())}`);
  }
  if (query.bloodGroup?.trim() && definition.bloodGroupColumn) {
    conditions.push(`${definition.bloodGroupColumn} = ${addValue(query.bloodGroup.trim())}`);
  }
  if (query.expiry && query.expiry !== "any" && definition.expiryColumn) {
    const operator = query.expiry === "expired" ? "<" : "between";
    if (operator === "<") {
      conditions.push(`${definition.expiryColumn} < current_date`);
    } else {
      conditions.push(`${definition.expiryColumn} between current_date and current_date + 30`);
    }
  }
  const where = conditions.length ? ` where ${conditions.join(" and ")}` : "";
  const result = await client.query(
    `select * from public.${definition.table}${where}`,
    values,
  );
  let items = result.rows.map((row: Record<string, unknown>) => rowToResource(type, row));
  if (query.status) {
    const requestedStatus = query.status.toUpperCase();
    items = items.filter((item) => String(item.data.status).toUpperCase() === requestedStatus);
  }
  const sortColumn =
    (query.sort && definition.sortableColumns[query.sort]) ?? "updated_at";
  const direction = query.direction === "asc" ? 1 : -1;
  const sortField = query.sort;
  items.sort((left, right) => {
    const leftValue =
      sortField && sortField in left.data
        ? left.data[sortField]
        : sortColumn === "created_at"
          ? left.createdAt
          : left.updatedAt;
    const rightValue =
      sortField && sortField in right.data
        ? right.data[sortField]
        : sortColumn === "created_at"
          ? right.createdAt
          : right.updatedAt;
    if (typeof leftValue === "number" && typeof rightValue === "number") {
      return (leftValue - rightValue) * direction;
    }
    return String(leftValue ?? "").localeCompare(String(rightValue ?? ""), undefined, {
      numeric: true,
      sensitivity: "base",
    }) * direction;
  });
  const total = items.length;
  const page = Math.max(query.page ?? 1, 1);
  const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
  const start = (page - 1) * limit;
  return { items: items.slice(start, start + limit), page, limit, total };
}

export async function insertResource(
  client: PoolClient,
  userId: string,
  type: ResourceType,
  value: unknown,
): Promise<ResourceRecord> {
  const data = validateResourceData(type, value);
  const definition = resourceDefinitions[type];
  const fields = Object.entries(definition.columns).filter(([field]) => field in data);
  const columns = ["user_id", ...fields.map(([, column]) => column)];
  const values = [userId, ...fields.map(([field]) => data[field])];
  const placeholders = values.map((_, index) => `$${index + 1}`);
  const result = await client.query(
    `insert into public.${definition.table} (${columns.join(", ")}) values (${placeholders.join(", ")}) returning *`,
    values,
  );
  return rowToResource(type, result.rows[0]);
}

export async function updateResource(
  client: PoolClient,
  type: ResourceType,
  id: string,
  value: unknown,
): Promise<ResourceRecord | null> {
  const data = validateResourceData(type, value);
  const definition = resourceDefinitions[type];
  const fields = Object.entries(definition.columns).filter(([field]) => field in data);
  const values = fields.map(([field]) => data[field]);
  const assignments = fields.map(([, column], index) => `${column} = $${index + 1}`);
  assignments.push("updated_at = now()");
  values.push(id);
  const result = await client.query(
    `update public.${definition.table} set ${assignments.join(", ")} where id = $${values.length} and archived_at is null returning *`,
    values,
  );
  return result.rows[0] ? rowToResource(type, result.rows[0]) : null;
}

function dateRisk(type: ResourceType, data: Record<string, unknown>): AlertDraft[] {
  if (type !== "medicines" && type !== "blood") return [];
  const days = expiryDays(data.expiryDate);
  if (days === null || days > 30) return [];
  const severity = days < 0 ? "CRITICAL" : days <= 7 ? "HIGH" : "WARNING";
  const resourceName =
    type === "medicines" ? String(data.name ?? "Medicine") : `${String(data.bloodGroup ?? "")} blood`;
  const timeText =
    days < 0
      ? `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago.`
      : days === 0
        ? "Expires today."
        : `Expires in ${days} day${days === 1 ? "" : "s"}.`;
  return [
    {
      fingerprint: `${type}:${String(data.id)}:expiry`,
      resourceType: type,
      resourceId: String(data.id),
      severity,
      title: `${resourceName} ${days < 0 ? "expired" : "expiring soon"}`,
      message: timeText,
    },
  ];
}

export function draftAlerts(resources: ResourceRecord[]): AlertDraft[] {
  const drafts: AlertDraft[] = [];
  for (const resource of resources) {
    const data: Record<string, unknown> = { ...resource.data, id: resource.id };
    const type = resource.resourceType;
    if (type === "icu-beds") {
      if (data.status === "critical" || data.status === "maintenance") {
        const severity = data.status === "critical" ? "CRITICAL" : "WARNING";
        drafts.push({
          fingerprint: `${type}:${resource.id}:status-${String(data.status)}`,
          resourceType: type,
          resourceId: resource.id,
          severity,
          title: data.status === "critical" ? "ICU bed needs attention" : "ICU bed is under maintenance",
          message: `${String(data.bedId)} in ${String(data.ward)} is marked ${String(data.status)}.`,
        });
      }
    } else if (type === "oxygen" || type === "ventilators") {
      if (data.status === "critical" || data.status === "maintenance" || Number(data.quantity ?? 1) === 0) {
        const severity = data.status === "critical" || Number(data.quantity ?? 1) === 0 ? "CRITICAL" : "WARNING";
        const label = type === "oxygen" ? "Oxygen equipment" : "Ventilators";
        drafts.push({
          fingerprint: `${type}:${resource.id}:status-${severity}`,
          resourceType: type,
          resourceId: resource.id,
          severity,
          title: `${label} needs attention`,
          message: `${String(data.name)} at ${String(data.location)} is marked ${String(data.status)}.`,
        });
      }
    } else if (type === "medicines") {
      const quantity = Number(data.quantity ?? 0);
      const reorder = Number(data.reorderLevel ?? 0);
      if (quantity <= reorder) {
        const severity =
          quantity === 0 || (reorder > 0 && quantity <= reorder * 0.5)
            ? "CRITICAL"
            : "WARNING";
        drafts.push({
          fingerprint: `${type}:${resource.id}:stock-${severity}`,
          resourceType: type,
          resourceId: resource.id,
          severity,
          title: `${String(data.name)} is below reorder level`,
          message: `${quantity} ${String(data.unit)} remain; reorder level is ${reorder}.`,
        });
      }
    } else if (type === "blood" && Number(data.quantity ?? 0) <= 5) {
      const quantity = Number(data.quantity ?? 0);
      const severity =
        data.status === "critical" || quantity <= 2 ? "CRITICAL" : "WARNING";
      drafts.push({
        fingerprint: `${type}:${resource.id}:stock-${severity}`,
        resourceType: type,
        resourceId: resource.id,
        severity,
        title: `${String(data.bloodGroup)} blood inventory is low`,
        message: `${quantity} unit${quantity === 1 ? "" : "s"} remain at ${String(data.location)}.`,
      });
    } else if (type === "blood" && data.status === "critical") {
      drafts.push({
        fingerprint: `${type}:${resource.id}:status-critical`,
        resourceType: type,
        resourceId: resource.id,
        severity: "CRITICAL",
        title: `${String(data.bloodGroup)} blood unit needs attention`,
        message: `A ${String(data.bloodGroup)} unit at ${String(data.location)} is marked critical.`,
      });
    }
    drafts.push(...dateRisk(type, data));
  }
  return drafts;
}

export async function syncAlerts(
  client: PoolClient,
  userId: string,
  resources: ResourceRecord[],
): Promise<Array<Record<string, unknown>>> {
  const drafts = draftAlerts(resources);
  await client.query(
    "update public.alerts set is_active = false, updated_at = now() where is_active = true",
  );
  for (const alert of drafts) {
    await client.query(
      `insert into public.alerts as existing
        (user_id, fingerprint, resource_type, resource_id, severity, title, message)
       values ($1, $2, $3, $4, $5, $6, $7)
       on conflict (user_id, fingerprint) do update set
         severity = excluded.severity,
         title = excluded.title,
         message = excluded.message,
         is_active = true,
         is_read = case when not existing.is_active then false else existing.is_read end,
         created_at = case when not existing.is_active then now() else existing.created_at end,
         updated_at = now()`,
      [
        userId,
        alert.fingerprint,
        alert.resourceType,
        alert.resourceId,
        alert.severity,
        alert.title,
        alert.message,
      ],
    );
  }
  const current = await client.query(
    "select id, resource_type, resource_id, severity, title, message, is_read, created_at from public.alerts where is_active = true order by case severity when 'CRITICAL' then 0 when 'HIGH' then 1 when 'WARNING' then 2 else 3 end, created_at desc",
  );
  return current.rows;
}

export function alertToApi(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: String(row.id),
    resourceType: row.resource_type,
    resourceId: String(row.resource_id),
    severity: row.severity,
    title: row.title,
    message: row.message,
    isRead: Boolean(row.is_read),
    createdAt: iso(row.created_at),
  };
}

export function resourceCounts(
  type: ResourceType,
  resources: ResourceRecord[],
): Record<string, number> {
  const sumQuantity = (predicate: (resource: ResourceRecord) => boolean) =>
    resources.reduce(
      (sum, resource) =>
        sum + (predicate(resource) ? Number(resource.data.quantity ?? 1) : 0),
      0,
    );
  const total =
    type === "icu-beds" || type === "ventilators"
      ? resources.length
      : sumQuantity(() => true);
  const available =
    type === "icu-beds" || type === "ventilators"
      ? resources.filter((resource) => resource.data.status === "available").length
      : sumQuantity((resource) => resource.data.status === "available");
  const inUse =
    type === "icu-beds"
      ? resources.filter((resource) => resource.data.status === "occupied").length
      : type === "ventilators"
        ? resources.filter((resource) => resource.data.status === "in-use").length
        : type === "oxygen"
          ? sumQuantity((resource) => resource.data.status === "in-use")
          : type === "blood"
            ? sumQuantity((resource) => resource.data.status === "reserved")
            : 0;
  return {
    total,
    available,
    inUse,
    critical: resources.filter((resource) =>
      ["critical", "expired"].includes(String(resource.data.status)),
    ).length,
    warning: resources.filter((resource) =>
      ["warning", "maintenance", "reserved"].includes(String(resource.data.status)),
    ).length,
    expiring: resources.filter((resource) => {
      const days = expiryDays(resource.data.expiryDate);
      return days !== null && days >= 0 && days <= 30;
    }).length,
  };
}
