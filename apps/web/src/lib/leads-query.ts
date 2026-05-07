import {
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  lte,
  or,
  type SQL
} from "drizzle-orm";
import { schema } from "@asbatechs-crm/database";
import type { AuthTokenPayload } from "@/lib/auth";
import { db } from "@/lib/db";
import { isRole } from "@/lib/rbac";
import { LEAD_STAGE_OPTIONS } from "@/lib/lead-workflow";

const HOT_STATUSES = LEAD_STAGE_OPTIONS;
const SALE_STATUSES = LEAD_STAGE_OPTIONS;

export type LeadType = "hot" | "sale" | "all";

export function parseListPagination(sp: URLSearchParams) {
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
  const limitRaw = parseInt(sp.get("limit") ?? "10", 10);
  const limit = Math.min(100, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 10));
  return { page, limit, offset: (page - 1) * limit };
}

function dayStartUtc(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}
function dayEndUtc(dateStr: string): Date {
  return new Date(`${dateStr}T23:59:59.999Z`);
}

export type LeadFilterResult =
  | { ok: true; conditions: SQL[] }
  | { ok: false; status: number; error: string };

export function collectLeadListConditions(
  leadType: LeadType,
  payload: AuthTokenPayload,
  sp: URLSearchParams
): LeadFilterResult {
  const conditions: SQL[] = [
    eq(schema.leads.isDeleted, false)
  ];
  if (leadType !== "all") {
    conditions.push(eq(schema.leads.type, leadType));
  }

  if (!isRole(payload.role)) {
    return {
      ok: false,
      status: 403,
      error: "Your account role cannot view this leads list."
    };
  }

  if (payload.role === "manager") {
    if (!payload.departmentId) {
      return {
        ok: false,
        status: 403,
        error:
          "Your manager profile has no department. Contact an administrator to assign a department."
      };
    }
    conditions.push(eq(schema.leads.departmentId, payload.departmentId));
  }
  const departmentId = sp.get("departmentId");
  const assignedUserId = sp.get("assignedUserId");
  if (payload.role === "manager" && departmentId) {
    const requested = Number(departmentId);
    if (
      !Number.isNaN(requested) &&
      payload.departmentId &&
      requested !== payload.departmentId
    ) {
      return {
        ok: false,
        status: 403,
        error: "You can only filter by your own department."
      };
    }
  }

  if (departmentId && !Number.isNaN(Number(departmentId))) {
    conditions.push(eq(schema.leads.departmentId, Number(departmentId)));
  }
  if (assignedUserId && !Number.isNaN(Number(assignedUserId))) {
    conditions.push(eq(schema.leads.assignedUserId, Number(assignedUserId)));
  }

  const search = sp.get("search")?.trim();
  if (search) {
    const pattern = `%${search}%`;
    if (leadType === "hot") {
      conditions.push(
        or(
          ilike(schema.leads.clientName, pattern),
          ilike(schema.leads.phone, pattern),
          ilike(schema.leads.email, pattern)
        )!
      );
    } else {
      conditions.push(
        or(
          ilike(schema.leads.clientName, pattern),
          ilike(schema.leads.phone, pattern),
          ilike(schema.leads.email, pattern),
          ilike(schema.leads.servicePurchased, pattern)
        )!
      );
    }
  }

  const status = sp.get("status")?.trim();
  if (status) {
    const allowed =
      leadType === "hot"
        ? (HOT_STATUSES as readonly string[]).includes(status)
        : (SALE_STATUSES as readonly string[]).includes(status);
    if (allowed) {
      conditions.push(eq(schema.leads.status, status));
    }
  }

  const createdFrom = sp.get("createdFrom")?.trim();
  const createdTo = sp.get("createdTo")?.trim();
  if (createdFrom && /^\d{4}-\d{2}-\d{2}$/.test(createdFrom)) {
    conditions.push(gte(schema.leads.createdAt, dayStartUtc(createdFrom)));
  }
  if (createdTo && /^\d{4}-\d{2}-\d{2}$/.test(createdTo)) {
    conditions.push(lte(schema.leads.createdAt, dayEndUtc(createdTo)));
  }

  if (leadType === "sale") {
    const saleDateFrom = sp.get("saleDateFrom")?.trim();
    const saleDateTo = sp.get("saleDateTo")?.trim();
    if (saleDateFrom && /^\d{4}-\d{2}-\d{2}$/.test(saleDateFrom)) {
      conditions.push(gte(schema.leads.saleDate, saleDateFrom));
    }
    if (saleDateTo && /^\d{4}-\d{2}-\d{2}$/.test(saleDateTo)) {
      conditions.push(lte(schema.leads.saleDate, saleDateTo));
    }
  } else {
    const followUpFrom = sp.get("followUpFrom")?.trim();
    const followUpTo = sp.get("followUpTo")?.trim();
    if (followUpFrom && /^\d{4}-\d{2}-\d{2}$/.test(followUpFrom)) {
      conditions.push(gte(schema.leads.nextFollowUpDate, followUpFrom));
    }
    if (followUpTo && /^\d{4}-\d{2}-\d{2}$/.test(followUpTo)) {
      conditions.push(lte(schema.leads.nextFollowUpDate, followUpTo));
    }
  }

  return { ok: true, conditions };
}

const HOT_SORT_COLUMNS = [
  "created_at",
  "updated_at",
  "client_name",
  "status",
  "department_id",
  "assigned_user_id",
  "source",
  "next_follow_up_date"
] as const;

const SALE_SORT_COLUMNS = [
  "created_at",
  "updated_at",
  "client_name",
  "status",
  "department_id",
  "assigned_user_id",
  "sale_amount",
  "sale_date",
  "service_purchased"
] as const;
const ALL_SORT_COLUMNS = [
  "created_at",
  "updated_at",
  "client_name",
  "status",
  "department_id",
  "assigned_user_id",
  "type",
  "source",
  "next_follow_up_date",
  "sale_amount",
  "sale_date",
  "service_purchased"
] as const;

export function resolveLeadOrderBy(leadType: LeadType, sp: URLSearchParams): SQL[] {
  const rawSort = sp.get("sort") ?? "created_at";
  const rawOrder = (sp.get("order") ?? "desc").toLowerCase();
  const order = rawOrder === "asc" ? "asc" : "desc";

  const allowed =
    leadType === "hot"
      ? HOT_SORT_COLUMNS
      : leadType === "sale"
      ? SALE_SORT_COLUMNS
      : ALL_SORT_COLUMNS;
  const sort = (allowed as readonly string[]).includes(rawSort) ? rawSort : "created_at";

  const col = (() => {
    switch (sort) {
      case "client_name":
        return schema.leads.clientName;
      case "updated_at":
        return schema.leads.updatedAt;
      case "status":
        return schema.leads.status;
      case "type":
        return schema.leads.type;
      case "department_id":
        return schema.leads.departmentId;
      case "assigned_user_id":
        return schema.leads.assignedUserId;
      case "source":
        return schema.leads.source;
      case "next_follow_up_date":
        return schema.leads.nextFollowUpDate;
      case "sale_amount":
        return schema.leads.saleAmount;
      case "sale_date":
        return schema.leads.saleDate;
      case "service_purchased":
        return schema.leads.servicePurchased;
      default:
        return schema.leads.createdAt;
    }
  })();

  const dir = order === "asc" ? asc : desc;
  return [dir(col), dir(schema.leads.id)];
}

export async function countLeads(whereClause: SQL) {
  const [row] = await db
    .select({ n: count() })
    .from(schema.leads)
    .where(whereClause);
  return Number(row?.n ?? 0);
}
