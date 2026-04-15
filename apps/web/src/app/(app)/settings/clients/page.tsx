import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { isAdminRole } from "@/lib/rbac";
import { InviteClientButton } from "@/components/InviteClientButton";
import { DeleteRegisteredClientButton } from "@/components/DeleteRegisteredClientButton";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { asc, desc, isNull } from "drizzle-orm";

export default async function AdminClientsSettingsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const session = token ? await verifyAuthToken(token) : null;

  if (!session || !isAdminRole(session.role)) {
    redirect("/dashboard");
  }

  const clients = await db
    .select({
      id: schema.clients.id,
      name: schema.clients.name,
      email: schema.clients.email,
      companyName: schema.clients.companyName,
      createdAt: schema.clients.createdAt
    })
    .from(schema.clients)
    .orderBy(desc(schema.clients.createdAt));

  const pendingInvites = await db
    .select({
      id: schema.clientInvitations.id,
      email: schema.clientInvitations.email,
      createdAt: schema.clientInvitations.createdAt
    })
    .from(schema.clientInvitations)
    .where(isNull(schema.clientInvitations.acceptedAt))
    .orderBy(asc(schema.clientInvitations.createdAt));

  return (
    <div className="space-y-8">
      <div className="app-panel rounded-[28px] px-6 py-7 sm:px-8">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-600 dark:text-sky-300">
          Administration
        </div>
        <h1 className="page-title mt-3">Client portal</h1>
        <p className="page-subtitle">
          Invite external clients by email only. After signup they sign in at the client portal (separate
          from staff accounts).
        </p>
        <div className="mt-6">
          <InviteClientButton />
        </div>
      </div>

      <section className="data-card overflow-hidden p-0">
        <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Pending invitations
          </h2>
        </div>
        <div className="max-h-64 overflow-auto">
          {pendingInvites.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">None</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {pendingInvites.map((i) => (
                <li key={i.id} className="px-4 py-2 text-sm">
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {i.email}
                  </span>
                  <span className="ml-2 text-xs text-slate-500">
                    {i.createdAt ? new Date(i.createdAt).toLocaleString() : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="data-card overflow-hidden p-0">
        <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Registered clients
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 dark:bg-slate-900/90 dark:text-slate-400">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Company</th>
                <th className="px-4 py-2">Joined</th>
                <th className="px-4 py-2 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {clients.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    No clients yet.
                  </td>
                </tr>
              ) : (
                clients.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30">
                    <td className="px-4 py-2 font-medium text-slate-900 dark:text-white">
                      {c.name}
                    </td>
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-400">{c.email}</td>
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-400">
                      {c.companyName ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-400">
                      {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex justify-center gap-2">
                        <a
                          href={`/api/admin/clients/${c.id}/portal-login`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          View as client
                        </a>
                        <DeleteRegisteredClientButton clientId={c.id} email={c.email} />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
