import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";

export default async function UsersPage() {
  const users = await db
    .select()
    .from(schema.users)
    .orderBy(schema.users.createdAt);
  const departments = await db
    .select()
    .from(schema.departments)
    .orderBy(schema.departments.name);

  const deptById = new Map(departments.map((d) => [d.id, d.name]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Users</h1>
        <p className="mt-1 text-sm text-slate-600">
          View employees and their roles and departments.
        </p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <table className="w-full table-auto text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs uppercase text-slate-500">
              <th className="pb-2 text-left">Name</th>
              <th className="pb-2 text-left">Email</th>
              <th className="pb-2 text-left">Role</th>
              <th className="pb-2 text-left">Department</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="py-4 text-center text-xs text-slate-500"
                >
                  No users found. Seed or create users via the register flow.
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr
                  key={user.id}
                  className="border-b border-slate-50 last:border-b-0"
                >
                  <td className="py-2 text-sm text-slate-900">{user.name}</td>
                  <td className="py-2 text-xs text-slate-600">{user.email}</td>
                  <td className="py-2 text-xs text-slate-700 capitalize">
                    {user.role}
                  </td>
                  <td className="py-2 text-xs text-slate-700">
                    {user.departmentId
                      ? deptById.get(user.departmentId) ?? "Unknown"
                      : "Unassigned"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

