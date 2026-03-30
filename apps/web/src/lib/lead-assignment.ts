import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import type { Role } from "./rbac";

export type LeadType = "hot" | "sale";

export async function pickRoundRobinAssigneeUserId(params: {
  leadType: LeadType;
  departmentId: number;
  eligibleRoles: Role[];
}): Promise<number | null> {
  const { leadType, departmentId, eligibleRoles } = params;

  const eligibleUsers = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(
      and(
        eq(schema.users.departmentId, departmentId),
        inArray(schema.users.role, eligibleRoles)
      )
    )
    .orderBy(schema.users.id);

  if (eligibleUsers.length === 0) return null;

  const [lastAssigned] = await db
    .select({ assignedUserId: schema.leads.assignedUserId })
    .from(schema.leads)
    .where(
      and(
        eq(schema.leads.type, leadType),
        eq(schema.leads.departmentId, departmentId),
        eq(schema.leads.isDeleted, false),
        isNotNull(schema.leads.assignedUserId)
      )
    )
    .orderBy(desc(schema.leads.createdAt))
    .limit(1);

  const lastId = lastAssigned?.assignedUserId ?? null;
  const lastIndex = lastId
    ? eligibleUsers.findIndex((u) => u.id === lastId)
    : -1;

  const nextIndex =
    (lastIndex + 1 + eligibleUsers.length) % eligibleUsers.length;
  return eligibleUsers[nextIndex]?.id ?? null;
}

export async function autoAssignLead(params: {
  leadType: LeadType;
  departmentId: number | null;
  eligibleRoles: Role[];
}): Promise<number | null> {
  const { leadType, departmentId, eligibleRoles } = params;
  if (!departmentId) return null;

  return pickRoundRobinAssigneeUserId({
    leadType,
    departmentId,
    eligibleRoles
  });
}

