import type { AdminSnapshot } from "@/lib/admin-snapshot-types";

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** UTF-8 BOM + multi-section CSV for Excel. */
export function adminSnapshotToCsv(snapshot: AdminSnapshot): string {
  const blocks: string[] = [];

  const push = (title: string, headers: string[], rows: Record<string, unknown>[]) => {
    blocks.push(title);
    blocks.push(headers.map((h) => csvCell(h)).join(","));
    for (const row of rows) {
      blocks.push(headers.map((h) => csvCell(row[h])).join(","));
    }
    blocks.push("");
  };

  push(
    "DEPARTMENTS",
    ["id", "name", "description", "createdAt", "updatedAt"],
    snapshot.departments.map((d) => ({
      id: d.id,
      name: d.name,
      description: d.description,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt
    }))
  );

  push(
    "USERS",
    [
      "id",
      "name",
      "email",
      "role",
      "departmentId",
      "departmentName",
      "inviteStatus",
      "createdAt"
    ],
    snapshot.users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      departmentId: u.departmentId,
      departmentName: u.departmentName,
      inviteStatus: u.inviteStatus,
      createdAt: u.createdAt
    }))
  );

  push(
    "PENDING_INVITES",
    ["id", "email", "departmentId", "departmentName", "createdAt"],
    snapshot.pendingInvites.map((i) => ({
      id: i.id,
      email: i.email,
      departmentId: i.departmentId,
      departmentName: i.departmentName,
      createdAt: i.createdAt
    }))
  );

  push(
    "LEADS",
    [
      "id",
      "type",
      "clientName",
      "phone",
      "email",
      "source",
      "departmentId",
      "departmentName",
      "assignedUserId",
      "assignedUserName",
      "status",
      "notesSummary",
      "saleAmount",
      "servicePurchased",
      "saleDate",
      "createdAt",
      "updatedAt"
    ],
    snapshot.leads.map((l) => ({
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
      saleAmount: l.saleAmount,
      servicePurchased: l.servicePurchased,
      saleDate: l.saleDate,
      createdAt: l.createdAt,
      updatedAt: l.updatedAt
    }))
  );

  push(
    "RECENT_ACTIVITY",
    [
      "id",
      "userId",
      "actorName",
      "actorEmail",
      "action",
      "entityType",
      "entityId",
      "createdAt"
    ],
    snapshot.recentActivity.map((a) => ({
      id: a.id,
      userId: a.userId,
      actorName: a.actorName,
      actorEmail: a.actorEmail,
      action: a.action,
      entityType: a.entityType,
      entityId: a.entityId,
      createdAt: a.createdAt
    }))
  );

  return `\uFEFF${blocks.join("\n").replace(/\n+$/, "")}\n`;
}
