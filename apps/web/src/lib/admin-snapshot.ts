import { alias } from "drizzle-orm/pg-core";
import { asc, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import type { AdminSnapshot } from "@/lib/admin-snapshot-types";

export type { AdminSnapshot } from "@/lib/admin-snapshot-types";

const ACTIVITY_LIMIT = 300;

function iso(d: Date | null | undefined): string | null {
  if (!d) return null;
  return new Date(d).toISOString();
}

export async function getAdminSnapshot(): Promise<AdminSnapshot> {
  const leadAssignee = alias(schema.users, "lead_assignee");
  const activityActor = alias(schema.users, "activity_actor");

  const deptRows = await db
    .select({
      id: schema.departments.id,
      name: schema.departments.name,
      description: schema.departments.description,
      createdAt: schema.departments.createdAt,
      updatedAt: schema.departments.updatedAt
    })
    .from(schema.departments)
    .orderBy(asc(schema.departments.name));

  const userRows = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      role: schema.users.role,
      departmentId: schema.users.departmentId,
      departmentName: schema.departments.name,
      inviteStatus: schema.users.inviteStatus,
      createdAt: schema.users.createdAt
    })
    .from(schema.users)
    .leftJoin(
      schema.departments,
      eq(schema.users.departmentId, schema.departments.id)
    )
    .orderBy(asc(schema.users.id));

  const leadRows = await db
    .select({
      id: schema.leads.id,
      type: schema.leads.type,
      clientName: schema.leads.clientName,
      phone: schema.leads.phone,
      email: schema.leads.email,
      source: schema.leads.source,
      departmentId: schema.leads.departmentId,
      departmentName: schema.departments.name,
      assignedUserId: schema.leads.assignedUserId,
      assignedUserName: leadAssignee.name,
      status: schema.leads.status,
      notesSummary: schema.leads.notesSummary,
      saleAmount: schema.leads.saleAmount,
      servicePurchased: schema.leads.servicePurchased,
      saleDate: schema.leads.saleDate,
      createdAt: schema.leads.createdAt,
      updatedAt: schema.leads.updatedAt
    })
    .from(schema.leads)
    .leftJoin(
      schema.departments,
      eq(schema.leads.departmentId, schema.departments.id)
    )
    .leftJoin(leadAssignee, eq(schema.leads.assignedUserId, leadAssignee.id))
    .orderBy(desc(schema.leads.id));

  const inviteRows = await db
    .select({
      id: schema.invitations.id,
      email: schema.invitations.email,
      departmentId: schema.invitations.departmentId,
      departmentName: schema.departments.name,
      createdAt: schema.invitations.createdAt
    })
    .from(schema.invitations)
    .leftJoin(
      schema.departments,
      eq(schema.invitations.departmentId, schema.departments.id)
    )
    .where(isNull(schema.invitations.acceptedAt))
    .orderBy(asc(schema.invitations.createdAt));

  const activityRows = await db
    .select({
      id: schema.activityLogs.id,
      userId: schema.activityLogs.userId,
      actorName: activityActor.name,
      actorEmail: activityActor.email,
      action: schema.activityLogs.action,
      entityType: schema.activityLogs.entityType,
      entityId: schema.activityLogs.entityId,
      createdAt: schema.activityLogs.createdAt
    })
    .from(schema.activityLogs)
    .innerJoin(
      activityActor,
      eq(schema.activityLogs.userId, activityActor.id)
    )
    .orderBy(desc(schema.activityLogs.createdAt))
    .limit(ACTIVITY_LIMIT);

  const hotCount = leadRows.filter((l) => l.type === "hot").length;
  const saleCount = leadRows.filter((l) => l.type === "sale").length;

  return {
    generatedAt: new Date().toISOString(),
    stats: {
      departments: deptRows.length,
      users: userRows.length,
      hotLeads: hotCount,
      saleLeads: saleCount,
      pendingInvites: inviteRows.length
    },
    departments: deptRows.map((d) => ({
      id: d.id,
      name: d.name,
      description: d.description,
      createdAt: iso(d.createdAt ?? undefined),
      updatedAt: iso(d.updatedAt ?? undefined)
    })),
    users: userRows.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      departmentId: u.departmentId,
      departmentName: u.departmentName,
      inviteStatus: u.inviteStatus,
      createdAt: iso(u.createdAt ?? undefined)
    })),
    leads: leadRows.map((l) => ({
      id: l.id,
      type: l.type,
      clientName: l.clientName,
      phone: l.phone,
      email: l.email,
      source: l.source,
      departmentId: l.departmentId,
      departmentName: l.departmentName,
      assignedUserId: l.assignedUserId,
      assignedUserName: l.assignedUserName,
      status: l.status,
      notesSummary: l.notesSummary,
      saleAmount:
        l.saleAmount !== null && l.saleAmount !== undefined
          ? String(l.saleAmount)
          : null,
      servicePurchased: l.servicePurchased,
      saleDate: l.saleDate ? String(l.saleDate) : null,
      createdAt: iso(l.createdAt ?? undefined),
      updatedAt: iso(l.updatedAt ?? undefined)
    })),
    pendingInvites: inviteRows.map((i) => ({
      id: i.id,
      email: i.email,
      departmentId: i.departmentId,
      departmentName: i.departmentName,
      createdAt: iso(i.createdAt ?? undefined)
    })),
    recentActivity: activityRows.map((a) => ({
      id: a.id,
      userId: a.userId,
      actorName: a.actorName,
      actorEmail: a.actorEmail,
      action: a.action,
      entityType: a.entityType,
      entityId: a.entityId,
      createdAt: iso(a.createdAt ?? undefined)
    }))
  };
}
