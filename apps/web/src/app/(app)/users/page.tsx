import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { InviteEmployeeButton } from "@/components/InviteEmployeeButton";
import {
  EmployeeDirectoryTable,
  type EmployeeDirectoryRow
} from "@/components/EmployeeDirectoryTable";
import { asc, isNull } from "drizzle-orm";

export default async function UsersPage() {
  const users = await db
    .select()
    .from(schema.users)
    .orderBy(schema.users.createdAt);
  const departments = await db
    .select()
    .from(schema.departments)
    .orderBy(schema.departments.name);

  const pendingInvites = await db
    .select()
    .from(schema.invitations)
    .where(isNull(schema.invitations.acceptedAt))
    .orderBy(asc(schema.invitations.createdAt));

  const deptById = new Map(departments.map((d) => [d.id, d.name]));
  const userEmails = new Set(users.map((u) => u.email.toLowerCase()));

  const filteredInvites = pendingInvites.filter(
    (inv) => !userEmails.has(inv.email.toLowerCase())
  );

  const userRows: EmployeeDirectoryRow[] = users.map((user) => ({
    kind: "user",
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    department: user.departmentId
      ? deptById.get(user.departmentId) ?? "Unknown"
      : "Unassigned",
    inviteStatus: user.inviteStatus ?? "accepted"
  }));

  const inviteRows: EmployeeDirectoryRow[] = filteredInvites.map((inv) => ({
    kind: "invite",
    id: inv.id,
    email: inv.email,
    department: inv.departmentId
      ? deptById.get(inv.departmentId) ?? "Unknown"
      : "Unassigned"
  }));

  const rows = [...inviteRows, ...userRows];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Employee</h1>
          <p className="mt-1 text-sm text-slate-600">
            View employees and their roles and departments.
          </p>
        </div>
        <InviteEmployeeButton />
      </div>
      <EmployeeDirectoryTable rows={rows} />
    </div>
  );
}
