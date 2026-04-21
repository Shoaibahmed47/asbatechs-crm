import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AdminExportControls } from "@/components/AdminExportControls";
import { COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { getAdminSnapshot } from "@/lib/admin-snapshot";

const tableHeadClass =
  "sticky top-0 z-[1] bg-slate-50 text-left text-xs text-slate-600 dark:bg-slate-900/95 dark:text-slate-400";
const tableHeadRowClass =
  "border-b border-slate-200 dark:border-slate-700";
const tableBodyClass =
  "divide-y divide-slate-100 text-xs text-slate-800 dark:divide-slate-800 dark:text-slate-200";
const tableRowHover = "hover:bg-slate-50/80 dark:hover:bg-slate-800/40";

function Panel({
  title,
  children
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="data-card overflow-hidden p-0">
      <h2 className="border-b border-slate-200/90 bg-slate-100/90 px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:border-slate-700 dark:bg-slate-900/85 dark:text-slate-300">
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
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            Admin control
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
            Full read-only view of departments, people, leads, and invites.
            Export everything as CSV or PDF for reporting.
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Snapshot time:{" "}
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {new Date(snapshot.generatedAt).toLocaleString()}
            </span>
          </p>
        </div>
        <AdminExportControls snapshot={snapshot} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {(
          [
            {
              label: "Departments",
              value: snapshot.stats.departments,
              href: "/settings/departments"
            },
            {
              label: "Users",
              value: snapshot.stats.users,
              href: "/users"
            },
            {
              label: "Hot leads",
              value: snapshot.stats.hotLeads,
              href: "/leads/hot"
            },
            {
              label: "Sale leads",
              value: snapshot.stats.saleLeads,
              href: "/leads/sales"
            },
            {
              label: "Pending invites",
              value: snapshot.stats.pendingInvites,
              href: "/users"
            },
            {
              label: "Clients",
              value: "Manage",
              href: "/settings/clients"
            }
          ] as const
        ).map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="data-card px-4 py-3 transition hover:border-sky-300 hover:bg-sky-50/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 dark:hover:border-sky-700 dark:hover:bg-sky-950/20"
          >
            <div className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
              {item.label}
            </div>
            <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
              {item.value}
            </div>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Departments">
          <table className="w-full text-sm">
            <thead className={tableHeadClass}>
              <tr className={tableHeadRowClass}>
                <th className="px-3 py-2 font-medium">ID</th>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Description</th>
              </tr>
            </thead>
            <tbody className={tableBodyClass}>
              {snapshot.departments.map((d) => (
                <tr key={d.id} className={tableRowHover}>
                  <td className="px-3 py-2 tabular-nums text-slate-600 dark:text-slate-400">
                    {d.id}
                  </td>
                  <td className="px-3 py-2 font-medium">{d.name}</td>
                  <td className="max-w-xs truncate px-3 py-2 text-slate-600 dark:text-slate-400">
                    {d.description ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title="Users">
          <table className="w-full text-sm">
            <thead className={tableHeadClass}>
              <tr className={tableHeadRowClass}>
                <th className="px-3 py-2 font-medium">ID</th>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="px-3 py-2 font-medium">Role</th>
                <th className="px-3 py-2 font-medium">Department</th>
                <th className="px-3 py-2 font-medium">Invite</th>
              </tr>
            </thead>
            <tbody className={tableBodyClass}>
              {snapshot.users.map((u) => (
                <tr key={u.id} className={tableRowHover}>
                  <td className="px-3 py-2 tabular-nums text-slate-600 dark:text-slate-400">
                    {u.id}
                  </td>
                  <td className="px-3 py-2 font-medium">{u.name}</td>
                  <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                    {u.email}
                  </td>
                  <td className="px-3 py-2 capitalize">{u.role}</td>
                  <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                    {u.departmentName ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                    {u.inviteStatus}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>

      {snapshot.pendingInvites.length > 0 && (
        <Panel title="Pending invitations">
          <table className="w-full text-sm">
            <thead className={tableHeadClass}>
              <tr className={tableHeadRowClass}>
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="px-3 py-2 font-medium">Department</th>
                <th className="px-3 py-2 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className={tableBodyClass}>
              {snapshot.pendingInvites.map((i) => (
                <tr key={i.id} className={tableRowHover}>
                  <td className="px-3 py-2">{i.email}</td>
                  <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                    {i.departmentName ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
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
          <thead className={tableHeadClass}>
            <tr className={tableHeadRowClass}>
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
          <tbody className={tableBodyClass}>
            {snapshot.leads.map((l) => (
              <tr key={l.id} className={tableRowHover}>
                <td className="px-3 py-2 tabular-nums text-slate-600 dark:text-slate-400">
                  {l.id}
                </td>
                <td className="px-3 py-2 capitalize">{l.type}</td>
                <td className="px-3 py-2 font-medium">{l.clientName}</td>
                <td className="max-w-[10rem] px-3 py-2 text-slate-600 dark:text-slate-400">
                  <span className="line-clamp-2">
                    {[l.phone, l.email].filter(Boolean).join(" · ") || "—"}
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                  {l.departmentName ?? "—"}
                </td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                  {l.assignedUserName ?? "—"}
                </td>
                <td className="px-3 py-2">{l.status}</td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
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
          <thead className={tableHeadClass}>
            <tr className={tableHeadRowClass}>
              <th className="px-3 py-2 font-medium">When</th>
              <th className="px-3 py-2 font-medium">User</th>
              <th className="px-3 py-2 font-medium">Action</th>
              <th className="px-3 py-2 font-medium">Entity</th>
              <th className="px-3 py-2 font-medium">ID</th>
            </tr>
          </thead>
          <tbody className={tableBodyClass}>
            {snapshot.recentActivity.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-6 text-center text-slate-500 dark:text-slate-400"
                >
                  No activity logged yet.
                </td>
              </tr>
            ) : (
              snapshot.recentActivity.map((a) => (
                <tr key={a.id} className={tableRowHover}>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-600 dark:text-slate-400">
                    {a.createdAt
                      ? new Date(a.createdAt).toLocaleString()
                      : "—"}
                  </td>
                  <td className="px-3 py-2">{a.actorName}</td>
                  <td className="max-w-xs truncate px-3 py-2">{a.action}</td>
                  <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                    {a.entityType}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-slate-600 dark:text-slate-400">
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
