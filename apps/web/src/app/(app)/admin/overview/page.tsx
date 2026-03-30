import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AdminExportControls } from "@/components/AdminExportControls";
import { COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { getAdminSnapshot } from "@/lib/admin-snapshot";

function Panel({
  title,
  children
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <h2 className="border-b-[3px] border-double border-slate-300 bg-slate-100/95 px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-600">
        {title}
      </h2>
      <div className="max-h-[min(24rem,50vh)] overflow-auto">{children}</div>
    </section>
  );
}

export default async function AdminOverviewPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const payload = token ? await verifyAuthToken(token) : null;

  if (
    !payload ||
    (payload.role !== "admin" && payload.role !== "manager")
  ) {
    redirect("/dashboard");
  }

  const snapshot = await getAdminSnapshot();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Admin control
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Full read-only view of departments, people, leads, and invites.
            Export everything as CSV or PDF for reporting.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Snapshot time:{" "}
            <span className="font-medium text-slate-700">
              {new Date(snapshot.generatedAt).toLocaleString()}
            </span>
          </p>
        </div>
        <AdminExportControls snapshot={snapshot} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {(
          [
            ["Departments", snapshot.stats.departments],
            ["Users", snapshot.stats.users],
            ["Hot leads", snapshot.stats.hotLeads],
            ["Sale leads", snapshot.stats.saleLeads],
            ["Pending invites", snapshot.stats.pendingInvites]
          ] as const
        ).map(([label, value]) => (
          <div
            key={label}
            className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm"
          >
            <div className="text-xs font-medium uppercase text-slate-500">
              {label}
            </div>
            <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
              {value}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Departments">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 text-left text-xs text-slate-600">
              <tr className="border-b border-slate-200">
                <th className="px-3 py-2 font-medium">ID</th>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-800">
              {snapshot.departments.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50/80">
                  <td className="px-3 py-2 tabular-nums text-slate-600">
                    {d.id}
                  </td>
                  <td className="px-3 py-2 font-medium">{d.name}</td>
                  <td className="max-w-xs truncate px-3 py-2 text-slate-600">
                    {d.description ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title="Users">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 text-left text-xs text-slate-600">
              <tr className="border-b border-slate-200">
                <th className="px-3 py-2 font-medium">ID</th>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="px-3 py-2 font-medium">Role</th>
                <th className="px-3 py-2 font-medium">Department</th>
                <th className="px-3 py-2 font-medium">Invite</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-800">
              {snapshot.users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/80">
                  <td className="px-3 py-2 tabular-nums text-slate-600">
                    {u.id}
                  </td>
                  <td className="px-3 py-2 font-medium">{u.name}</td>
                  <td className="px-3 py-2 text-slate-600">{u.email}</td>
                  <td className="px-3 py-2 capitalize">{u.role}</td>
                  <td className="px-3 py-2 text-slate-600">
                    {u.departmentName ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{u.inviteStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>

      {snapshot.pendingInvites.length > 0 && (
        <Panel title="Pending invitations">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 text-left text-xs text-slate-600">
              <tr className="border-b border-slate-200">
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="px-3 py-2 font-medium">Department</th>
                <th className="px-3 py-2 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-800">
              {snapshot.pendingInvites.map((i) => (
                <tr key={i.id} className="hover:bg-slate-50/80">
                  <td className="px-3 py-2">{i.email}</td>
                  <td className="px-3 py-2 text-slate-600">
                    {i.departmentName ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {i.createdAt
                      ? new Date(i.createdAt).toLocaleString()
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}

      <Panel title="All leads (hot & sale)">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-50 text-left text-xs text-slate-600">
            <tr className="border-b border-slate-200">
              <th className="px-3 py-2 font-medium">ID</th>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">Client</th>
              <th className="px-3 py-2 font-medium">Contact</th>
              <th className="px-3 py-2 font-medium">Dept</th>
              <th className="px-3 py-2 font-medium">Assigned</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Sale</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs text-slate-800">
            {snapshot.leads.map((l) => (
              <tr key={l.id} className="hover:bg-slate-50/80">
                <td className="px-3 py-2 tabular-nums text-slate-600">
                  {l.id}
                </td>
                <td className="px-3 py-2 capitalize">{l.type}</td>
                <td className="px-3 py-2 font-medium">{l.clientName}</td>
                <td className="max-w-[10rem] px-3 py-2 text-slate-600">
                  <span className="line-clamp-2">
                    {[l.phone, l.email].filter(Boolean).join(" · ") || "—"}
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-600">
                  {l.departmentName ?? "—"}
                </td>
                <td className="px-3 py-2 text-slate-600">
                  {l.assignedUserName ?? "—"}
                </td>
                <td className="px-3 py-2">{l.status}</td>
                <td className="px-3 py-2 text-slate-600">
                  {l.type === "sale" && l.saleAmount
                    ? l.saleAmount
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel title={`Recent activity (last ${snapshot.recentActivity.length} events)`}>
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-50 text-left text-xs text-slate-600">
            <tr className="border-b border-slate-200">
              <th className="px-3 py-2 font-medium">When</th>
              <th className="px-3 py-2 font-medium">User</th>
              <th className="px-3 py-2 font-medium">Action</th>
              <th className="px-3 py-2 font-medium">Entity</th>
              <th className="px-3 py-2 font-medium">ID</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs text-slate-800">
            {snapshot.recentActivity.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-6 text-center text-slate-500"
                >
                  No activity logged yet.
                </td>
              </tr>
            ) : (
              snapshot.recentActivity.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50/80">
                  <td className="whitespace-nowrap px-3 py-2 text-slate-600">
                    {a.createdAt
                      ? new Date(a.createdAt).toLocaleString()
                      : "—"}
                  </td>
                  <td className="px-3 py-2">{a.actorName}</td>
                  <td className="max-w-xs truncate px-3 py-2">{a.action}</td>
                  <td className="px-3 py-2 text-slate-600">{a.entityType}</td>
                  <td className="px-3 py-2 tabular-nums text-slate-600">
                    {a.entityId}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
