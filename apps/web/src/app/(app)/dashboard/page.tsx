import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { isAdminRole } from "@/lib/rbac";
import { getLocalDateString } from "@/lib/attendance-date";
import { getAttendanceStatusForDate } from "@/lib/attendance-status-today";
import { AdminAttendanceLivePanel } from "@/components/AdminAttendanceLivePanel";
import { DashboardCharts } from "@/components/DashboardCharts";
import { and, count, desc, eq, gte, isNotNull, sql, sum } from "drizzle-orm";

function monthKeysLast(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

function formatMonthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return new Date(y, m - 1, 1).toLocaleString(undefined, {
    month: "short",
    year: "numeric"
  });
}

function startOfRollingMonthsAgo(monthsBackFromStart: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - monthsBackFromStart);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const session = token ? await verifyAuthToken(token) : null;
  /** Org-wide live attendance (table + aggregated counts): administrators only. */
  const isAdminViewer = isAdminRole(session?.role);

  const [hotCount] = await db
    .select({ value: count() })
    .from(schema.leads)
    .where(and(eq(schema.leads.type, "hot"), eq(schema.leads.isDeleted, false)));
  const [saleCount] = await db
    .select({ value: count() })
    .from(schema.leads)
    .where(and(eq(schema.leads.type, "sale"), eq(schema.leads.isDeleted, false)));
  const [totalSales] = await db
    .select({ value: sum(schema.leads.saleAmount) })
    .from(schema.leads)
    .where(
      and(
        eq(schema.leads.type, "sale"),
        isNotNull(schema.leads.saleAmount),
        eq(schema.leads.isDeleted, false)
      )
    );

  const [userCount] = await db.select({ value: count() }).from(schema.users);

  const totalLeads = Number(hotCount?.value ?? 0) + Number(saleCount?.value ?? 0);
  const totalSalesAmount = Number(totalSales?.value ?? 0);
  const totalUsers = Number(userCount?.value ?? 0);

  const today = getLocalDateString();
  const todaysLogs = await db
    .select()
    .from(schema.attendanceLogs)
    .where(eq(schema.attendanceLogs.date, today as any));
  const activeToday = todaysLogs.filter((l) => l.clockIn && !l.clockOut).length;

  const liveAttendanceToday = isAdminViewer
    ? await getAttendanceStatusForDate(today)
    : null;

  const assignedClientProjects =
    session?.role === "employee"
      ? await db
          .select({
            assignmentId: schema.employeeClientProjectAssignments.id,
            clientName: schema.clients.name,
            projectName: schema.clientProjects.name,
            assignedAt: schema.employeeClientProjectAssignments.createdAt
          })
          .from(schema.employeeClientProjectAssignments)
          .innerJoin(
            schema.clients,
            eq(schema.employeeClientProjectAssignments.clientId, schema.clients.id)
          )
          .innerJoin(
            schema.clientProjects,
            eq(schema.employeeClientProjectAssignments.projectId, schema.clientProjects.id)
          )
          .where(eq(schema.employeeClientProjectAssignments.userId, session.userId))
          .orderBy(desc(schema.employeeClientProjectAssignments.createdAt))
      : [];

  const months = monthKeysLast(6);
  const saleFrom = startOfRollingMonthsAgo(5);
  const saleMonthExpr = sql<string>`to_char(${schema.leads.saleDate}, 'YYYY-MM')`;
  const monthlySalesRows = await db
    .select({
      month: saleMonthExpr,
      total: sum(schema.leads.saleAmount)
    })
    .from(schema.leads)
    .where(
      and(
        eq(schema.leads.type, "sale"),
        isNotNull(schema.leads.saleDate),
        eq(schema.leads.isDeleted, false),
        gte(schema.leads.saleDate, saleFrom.toISOString().slice(0, 10) as any)
      )
    )
    .groupBy(saleMonthExpr)
    .orderBy(saleMonthExpr);

  const salesByMonth = new Map(monthlySalesRows.map((r) => [r.month, Number(r.total ?? 0)]));
  const monthlySales = months.map((m) => ({
    month: m,
    label: formatMonthLabel(m),
    amount: salesByMonth.get(m) ?? 0
  }));

  const leadCreatedFrom = startOfRollingMonthsAgo(5);
  const createdMonthExpr = sql<string>`to_char(${schema.leads.createdAt}, 'YYYY-MM')`;
  const monthlyNewRows = await db
    .select({
      month: createdMonthExpr,
      c: count()
    })
    .from(schema.leads)
    .where(and(eq(schema.leads.isDeleted, false), gte(schema.leads.createdAt, leadCreatedFrom)))
    .groupBy(createdMonthExpr)
    .orderBy(createdMonthExpr);

  const newByMonth = new Map(monthlyNewRows.map((r) => [r.month, Number(r.c ?? 0)]));
  const monthlyNewLeads = months.map((m) => ({
    month: m,
    label: formatMonthLabel(m),
    count: newByMonth.get(m) ?? 0
  }));

  return (
    <div className="space-y-8">
      <section className="app-panel rounded-[28px] px-6 py-7 sm:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-600 dark:text-sky-300">
              Executive overview
            </div>
            <h1 className="page-title mt-3">CRM dashboard</h1>
            <p className="page-subtitle">
              Track lead pipeline health, revenue momentum
              {isAdminViewer ? ", and live team attendance " : " "}
              from one professional operations view.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="app-panel-muted rounded-2xl px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                Total team members
              </div>
              <div className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">
                {totalUsers}
              </div>
            </div>
            <div className="app-panel-muted rounded-2xl px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                {isAdminViewer ? "Team attendance (today)" : "Attendance"}
              </div>
              {isAdminViewer && liveAttendanceToday ? (
                <div className="mt-2 space-y-1 text-sm">
                  <div className="flex flex-wrap gap-x-3 gap-y-1 font-semibold">
                    <span className="text-emerald-600 dark:text-emerald-400">
                      {liveAttendanceToday.people.filter((p) => p.status === "active").length}{" "}
                      active
                    </span>
                    <span className="text-amber-700 dark:text-amber-400">
                      {liveAttendanceToday.people.filter((p) => p.status === "break").length}{" "}
                      break
                    </span>
                    <span className="text-slate-500 dark:text-slate-400">
                      {liveAttendanceToday.people.filter((p) => p.status === "offline").length}{" "}
                      offline
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {activeToday} with an open shift (incl. break)
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
                  Clock in, breaks, and your hours are on the{" "}
                  <span className="font-medium text-slate-800 dark:text-slate-200">Attendance</span>{" "}
                  page. Live team status is available to administrators only.
                </p>
              )}
            </div>
            <div className="app-panel-muted rounded-2xl px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                Revenue booked
              </div>
              <div className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">
                {totalSalesAmount.toLocaleString(undefined, {
                  style: "currency",
                  currency: "USD"
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {isAdminViewer && liveAttendanceToday ? (
        <AdminAttendanceLivePanel people={liveAttendanceToday.people} date={liveAttendanceToday.date} />
      ) : null}

      {session?.role === "employee" ? (
        <section className="data-card">
          <div className="mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Assigned client projects
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              These are the client projects assigned to your account by admin.
            </p>
          </div>
          {assignedClientProjects.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-500">
              No client project assigned yet.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {assignedClientProjects.map((item) => (
                <article
                  key={item.assignmentId}
                  className="rounded-xl border border-slate-200/80 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900/70"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                    {item.clientName}
                  </p>
                  <p className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-100">
                    {item.projectName}
                  </p>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    Assigned{" "}
                    {item.assignedAt ? new Date(item.assignedAt).toLocaleDateString() : "recently"}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="metric-card">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            Total leads
          </div>
          <div className="mt-3 text-3xl font-semibold text-slate-950 dark:text-white">
            {totalLeads}
          </div>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Combined hot and sales pipeline records.
          </p>
        </div>

        <div className="metric-card">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            Hot leads
          </div>
          <div className="mt-3 text-3xl font-semibold text-sky-600 dark:text-sky-400">
            {Number(hotCount?.value ?? 0)}
          </div>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Prioritized follow-up opportunities awaiting action.
          </p>
        </div>

        <div className="metric-card">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            Sales leads
          </div>
          <div className="mt-3 text-3xl font-semibold text-violet-600 dark:text-violet-400">
            {Number(saleCount?.value ?? 0)}
          </div>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Records mapped to closing and revenue tracking.
          </p>
        </div>

        <div className="metric-card">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            Open shifts
          </div>
          <div className="mt-3 text-3xl font-semibold text-emerald-600 dark:text-emerald-400">
            {activeToday}
          </div>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Employees currently clocked in and not yet clocked out.
          </p>
        </div>
      </section>

      <DashboardCharts
        showTeamAttendanceOverview={isAdminViewer}
        data={{
          hotLeads: Number(hotCount?.value ?? 0),
          saleLeads: Number(saleCount?.value ?? 0),
          totalSalesAmount,
          activeToday,
          totalUsers,
          monthlySales,
          monthlyNewLeads
        }}
      />
    </div>
  );
}
