import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { eq } from "drizzle-orm";

function formatRoleLabel(role: string): string {
  if (!role) return "—";
  return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
}

export default async function AccountPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const session = token ? await verifyAuthToken(token) : null;
  if (!session) {
    redirect("/login");
  }

  const [row] = await db
    .select({
      name: schema.users.name,
      email: schema.users.email,
      role: schema.users.role,
      departmentName: schema.departments.name,
      createdAt: schema.users.createdAt
    })
    .from(schema.users)
    .leftJoin(schema.departments, eq(schema.users.departmentId, schema.departments.id))
    .where(eq(schema.users.id, session.userId));

  if (!row) {
    redirect("/login");
  }

  return (
    <div className="space-y-6">
      <div className="app-panel rounded-[28px] px-6 py-7 sm:px-8">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-600 dark:text-sky-300">
          Your profile
        </div>
        <h1 className="page-title mt-3">Account</h1>
        <p className="page-subtitle">
          Signed-in user details from your organization directory. Contact an admin to change department or role.
        </p>

        <dl className="mt-8 grid gap-6 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Name
            </dt>
            <dd className="mt-1 text-sm font-medium text-slate-950 dark:text-white">{row.name}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Email
            </dt>
            <dd className="mt-1 text-sm font-medium text-slate-950 dark:text-white">{row.email}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Department
            </dt>
            <dd className="mt-1 text-sm font-medium text-slate-950 dark:text-white">
              {row.departmentName ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Role
            </dt>
            <dd className="mt-1 text-sm font-medium text-slate-950 dark:text-white">
              {formatRoleLabel(row.role)}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Member since
            </dt>
            <dd className="mt-1 text-sm font-medium text-slate-950 dark:text-white">
              {row.createdAt
                ? new Date(row.createdAt).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "long",
                    day: "numeric"
                  })
                : "—"}
            </dd>
          </div>
        </dl>

        <div className="mt-8">
          <Link
            href="/dashboard"
            className="text-sm font-semibold text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300"
          >
            ← Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
