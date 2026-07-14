import { cookies } from "next/headers";
import Link from "next/link";
import { Suspense } from "react";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { isAdminRole } from "@/lib/rbac";
import { getLocalDateString } from "@/lib/attendance-date";
import { getAttendanceStatusForDate } from "@/lib/attendance-status-today";
import { DashboardChartsLazy } from "@/components/DashboardChartsLazy";
import {
  DashboardLiveAttendanceCommandCards,
  DashboardLiveAttendanceSummary,
  DashboardLiveOpenShiftsMetric,
  LiveAttendanceCountsProvider,
  type LiveAttendanceCounts
} from "@/components/DashboardLiveAttendanceCounts";
import { and, asc, count, desc, eq, gte, isNotNull, isNull, sql, sum } from "drizzle-orm";
import {
  getAttendanceAgentHealth,
} from "@/lib/attendance-agent-health";
import { normalizeAgentHealthFilter } from "@/lib/attendance-agent-health-display";
import { AttendanceReportFilters } from "@/app/(app)/attendance/report/AttendanceReportFilters";
import { AttendanceReportTablesLazy } from "@/components/attendance/AttendanceReportTablesLazy";

function monthKeysLast(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    //get month key
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

function pickDateParam(value: string | string[] | undefined): string | undefined {
  if (value == null) return undefined;
  const s = Array.isArray(value) ? value[0] : value;
  return typeof s === "string" ? s : undefined;
}

function shiftDate(iso: string, deltaDays: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() + deltaDays);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function getRangeFromPreset(preset: string, today: string): { from: string; to: string } {
  const now = new Date(`${today}T00:00:00`);
  const year = now.getFullYear();
  const month = now.getMonth();
  if (preset === "last_7_days") return { from: shiftDate(today, -6), to: today };
  if (preset === "last_14_days") return { from: shiftDate(today, -13), to: today };
  if (preset === "last_month") {
    const d = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0).getDate();
    const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
    const to = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      lastDay
    ).padStart(2, "0")}`;
    return { from, to };
  }
  return { from: today, to: today };
}

export default async function DashboardPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const session = token ? await verifyAuthToken(token) : null;
  /** Org-wide live attendance (table + aggregated counts): administrators only. */
  const isAdminViewer = isAdminRole(session?.role);

  const today = getLocalDateString();
  const sp = (await Promise.resolve(searchParams)) ?? {};
  const dateRaw = pickDateParam(sp.date);
  const reportModeRaw = (pickDateParam(sp.mode) ?? "daily").toLowerCase();
  const reportMode = reportModeRaw === "range" ? "range" : "daily";
  const presetRaw = (pickDateParam(sp.preset) ?? "").toLowerCase();
  const reportSearch = (pickDateParam(sp.search) ?? "").trim();
  const statusRaw = (pickDateParam(sp.status) ?? "").toLowerCase();
  const departmentRaw = pickDateParam(sp.departmentId);
  const statusFilter =
    statusRaw === "present" || statusRaw === "working" || statusRaw === "absent"
      ? statusRaw
      : "all";
  const agentStateRaw = (pickDateParam(sp.agentState) ?? "").toLowerCase();
  const alertsOnly = pickDateParam(sp.alerts) === "1";
  const agentStateFilter = normalizeAgentHealthFilter(agentStateRaw || null);
  const departmentFilter =
    departmentRaw && /^\d+$/.test(departmentRaw) ? Number(departmentRaw) : null;
  const reportDate =
    dateRaw && /^\d{4}-\d{2}-\d{2}$/.test(dateRaw) ? dateRaw : today;
  const fromRaw = pickDateParam(sp.from);
  const toRaw = pickDateParam(sp.to);
  const presetRange =
    presetRaw === "last_7_days" ||
    presetRaw === "last_14_days" ||
    presetRaw === "last_month"
      ? getRangeFromPreset(presetRaw, today)
      : null;
  const fromDate =
    presetRange?.from ??
    (fromRaw && /^\d{4}-\d{2}-\d{2}$/.test(fromRaw) ? fromRaw : reportDate);
  const toDate =
    presetRange?.to ??
    (toRaw && /^\d{4}-\d{2}-\d{2}$/.test(toRaw) ? toRaw : reportDate);
  const normalizedFrom = fromDate <= toDate ? fromDate : toDate;
  const normalizedTo = fromDate <= toDate ? toDate : fromDate;

  const months = monthKeysLast(6);
  const saleFrom = startOfRollingMonthsAgo(5);
  const saleMonthExpr = sql<string>`to_char(${schema.leads.saleDate}, 'YYYY-MM')`;
  const leadCreatedFrom = startOfRollingMonthsAgo(5);
  const createdMonthExpr = sql<string>`to_char(${schema.leads.createdAt}, 'YYYY-MM')`;
  const adminScope = { role: "admin" as const, departmentId: null };

  const [
    hotResult,
    saleResult,
    totalSalesResult,
    userCountResult,
    openShiftCountResult,
    liveAttendanceResult,
    departmentsResult,
    agentHealthResult,
    assignedClientProjectsResult,
    monthlySalesResult,
    monthlyNewLeadsResult
  ] = await Promise.allSettled([
    db
      .select({ value: count() })
      .from(schema.leads)
      .where(and(eq(schema.leads.type, "hot"), eq(schema.leads.isDeleted, false))),
    db
      .select({ value: count() })
      .from(schema.leads)
      .where(and(eq(schema.leads.type, "sale"), eq(schema.leads.isDeleted, false))),
    db
      .select({ value: sum(schema.leads.saleAmount) })
      .from(schema.leads)
      .where(
        and(
          eq(schema.leads.type, "sale"),
          isNotNull(schema.leads.saleAmount),
          eq(schema.leads.isDeleted, false)
        )
      ),
    db.select({ value: count() }).from(schema.users),
    db
      .select({ value: count() })
      .from(schema.attendanceLogs)
      .where(
        and(
          eq(schema.attendanceLogs.date, today as any),
          isNotNull(schema.attendanceLogs.clockIn),
          isNull(schema.attendanceLogs.clockOut)
        )
      ),
    isAdminViewer ? getAttendanceStatusForDate(today) : Promise.resolve(null),
    isAdminViewer
      ? db
          .select({ id: schema.departments.id, name: schema.departments.name })
          .from(schema.departments)
          .orderBy(asc(schema.departments.name))
      : Promise.resolve([]),
    isAdminViewer
      ? getAttendanceAgentHealth({
          date: reportDate,
          scope: adminScope,
          search: reportSearch,
          departmentFilter,
          stateFilter: agentStateFilter,
          alertsOnly
        })
      : Promise.resolve(null),
    session?.role === "employee"
      ? db
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
      : Promise.resolve([]),
    db
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
      .orderBy(saleMonthExpr),
    db
      .select({
        month: createdMonthExpr,
        c: count()
      })
      .from(schema.leads)
      .where(and(eq(schema.leads.isDeleted, false), gte(schema.leads.createdAt, leadCreatedFrom)))
      .groupBy(createdMonthExpr)
      .orderBy(createdMonthExpr)
  ]);

  const dashboardLoadErrors: string[] = [];
  const attendanceLoadErrors: string[] = [];
  const hotCount =
    hotResult.status === "fulfilled" ? hotResult.value[0] : undefined;
  const saleCount =
    saleResult.status === "fulfilled" ? saleResult.value[0] : undefined;
  const totalSales =
    totalSalesResult.status === "fulfilled" ? totalSalesResult.value[0] : undefined;
  const userCount =
    userCountResult.status === "fulfilled" ? userCountResult.value[0] : undefined;
  const openShiftCount =
    openShiftCountResult.status === "fulfilled" ? openShiftCountResult.value[0] : undefined;

  if (hotResult.status === "rejected") {
    console.error("[dashboard] hot leads count", hotResult.reason);
    dashboardLoadErrors.push("Lead counts could not be loaded.");
  }
  if (saleResult.status === "rejected") {
    console.error("[dashboard] sales stats", saleResult.reason);
    if (!dashboardLoadErrors.includes("Lead counts could not be loaded.")) {
      dashboardLoadErrors.push("Sales summary could not be loaded.");
    }
  }
  if (totalSalesResult.status === "rejected") {
    console.error("[dashboard] total sales", totalSalesResult.reason);
    if (!dashboardLoadErrors.includes("Lead counts could not be loaded.")) {
      dashboardLoadErrors.push("Sales summary could not be loaded.");
    }
  }
  if (userCountResult.status === "rejected") {
    console.error("[dashboard] user count", userCountResult.reason);
    dashboardLoadErrors.push("Team member count could not be loaded.");
  }
  if (openShiftCountResult.status === "rejected") {
    console.error("[dashboard] open shift count", openShiftCountResult.reason);
    dashboardLoadErrors.push("Today’s attendance snapshot could not be loaded.");
  }

  const totalLeads = Number(hotCount?.value ?? 0) + Number(saleCount?.value ?? 0);
  const totalSalesAmount = Number(totalSales?.value ?? 0);
  const totalUsers = Number(userCount?.value ?? 0);

  let liveAttendanceToday: Awaited<ReturnType<typeof getAttendanceStatusForDate>> | null = null;
  if (liveAttendanceResult.status === "fulfilled") {
    liveAttendanceToday = liveAttendanceResult.value;
  } else if (isAdminViewer && liveAttendanceResult.status === "rejected") {
    console.error("[dashboard] live attendance", liveAttendanceResult.reason);
    dashboardLoadErrors.push("Live attendance status could not be loaded.");
  }

  let attendanceDepartments: { id: number; name: string }[] = [];
  let attendanceAgentHealth: Awaited<ReturnType<typeof getAttendanceAgentHealth>> | null = null;

  if (departmentsResult.status === "fulfilled") {
    attendanceDepartments = departmentsResult.value;
  } else if (isAdminViewer && departmentsResult.status === "rejected") {
    console.error("[dashboard/attendance-report] departments", departmentsResult.reason);
    attendanceLoadErrors.push("Department filter could not be loaded.");
  }

  if (agentHealthResult.status === "fulfilled") {
    attendanceAgentHealth = agentHealthResult.value;
  } else if (isAdminViewer && agentHealthResult.status === "rejected") {
    console.error("[dashboard/attendance-report] agent health", agentHealthResult.reason);
    attendanceLoadErrors.push("Agent health table could not be loaded.");
  }

  const assignedClientProjects =
    assignedClientProjectsResult.status === "fulfilled"
      ? assignedClientProjectsResult.value
      : [];

  const monthlySalesRows =
    monthlySalesResult.status === "fulfilled" ? monthlySalesResult.value : [];
  const salesByMonth = new Map(monthlySalesRows.map((r) => [r.month, Number(r.total ?? 0)]));
  const monthlySales = months.map((m) => ({
    month: m,
    label: formatMonthLabel(m),
    amount: salesByMonth.get(m) ?? 0
  }));

  const monthlyNewRows =
    monthlyNewLeadsResult.status === "fulfilled" ? monthlyNewLeadsResult.value : [];
  const newByMonth = new Map(monthlyNewRows.map((r) => [r.month, Number(r.c ?? 0)]));
  const monthlyNewLeads = months.map((m) => ({
    month: m,
    label: formatMonthLabel(m),
    count: newByMonth.get(m) ?? 0
  }));

  const activeToday =
    liveAttendanceToday != null
      ? liveAttendanceToday.people.filter((person) => person.clockIn && !person.clockOut).length
      : Number(openShiftCount?.value ?? 0);

  const initialLiveAttendanceCounts: LiveAttendanceCounts = {
    active: liveAttendanceToday?.people.filter((p) => p.status === "active").length ?? 0,
    onBreak: liveAttendanceToday?.people.filter((p) => p.status === "break").length ?? 0,
    offline: liveAttendanceToday?.people.filter((p) => p.status === "offline").length ?? 0,
    openShifts: activeToday
  };

  const attendanceBaseQueryParams = new URLSearchParams();
  attendanceBaseQueryParams.set("date", reportDate);
  attendanceBaseQueryParams.set("mode", reportMode);
  attendanceBaseQueryParams.set("from", normalizedFrom);
  attendanceBaseQueryParams.set("to", normalizedTo);
  if (presetRaw) attendanceBaseQueryParams.set("preset", presetRaw);
  if (reportSearch) attendanceBaseQueryParams.set("search", reportSearch);
  if (departmentFilter != null) {
    attendanceBaseQueryParams.set("departmentId", String(departmentFilter));
  }
  if (statusFilter !== "all" && reportMode === "daily") {
    attendanceBaseQueryParams.set("status", statusFilter);
  }
  if (alertsOnly) attendanceBaseQueryParams.set("alerts", "1");

  const reportPrev = shiftDate(reportDate, -1);
  const reportNext = shiftDate(reportDate, 1);
  const attendanceDetailDate = reportMode === "daily" ? reportDate : normalizedTo;
  const attendanceLoadError =
    attendanceLoadErrors.length > 0 ? attendanceLoadErrors.join(" ") : null;
  const dashboardLoadError =
    dashboardLoadErrors.length > 0 ? dashboardLoadErrors.join(" ") : null;

  const dashboardBody = (
    <div className="space-y-8">
      {dashboardLoadError ? (
        <div
          className="rounded-2xl border border-amber-200/90 bg-amber-50/90 px-4 py-4 text-base leading-relaxed text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100"
          role="alert"
        >
          <p className="font-semibold">Some dashboard data could not be loaded</p>
          <p className="mt-1">{dashboardLoadError}</p>
          <p className="mt-2 text-sm text-amber-900/90 dark:text-amber-200/90">
            This is usually a temporary database connection issue. Check your internet, confirm
            Supabase is active, then refresh. If it keeps happening, verify{" "}
            <code className="rounded bg-amber-100/80 px-1 dark:bg-amber-900/50">DATABASE_URL</code>{" "}
            in <code className="rounded bg-amber-100/80 px-1 dark:bg-amber-900/50">apps/web/.env</code>.
          </p>
        </div>
      ) : null}
      <section className="app-panel rounded-[24px] px-4 py-5 sm:rounded-[28px] sm:px-8 sm:py-7">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="glass-chip inline-flex text-sky-700 dark:text-sky-200">
              Executive overview
            </div>
            <p className="page-subtitle mt-4">
              Track lead pipeline health, revenue momentum
              {isAdminViewer ? ", and live team attendance " : " "}
              from one professional operations view.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="app-panel-muted rounded-2xl px-4 py-3">
              <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                Total team members
              </div>
              <div className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">
                {totalUsers}
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-slate-200/70 dark:bg-slate-700/60">
                <div className="h-full w-3/5 rounded-full bg-sky-500/85" />
              </div>
            </div>
            <div className="app-panel-muted rounded-2xl px-4 py-3">
              <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                {isAdminViewer ? "Team attendance (today)" : "Attendance"}
              </div>
              {isAdminViewer && liveAttendanceToday ? (
                <DashboardLiveAttendanceSummary initial={initialLiveAttendanceCounts} />
              ) : (
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
                  Clock in, breaks, and your hours are on the{" "}
                  <span className="font-medium text-slate-800 dark:text-slate-200">Attendance</span>{" "}
                  page. Live team status is available to administrators only.
                </p>
              )}
              <div className="mt-2 h-1.5 rounded-full bg-slate-200/70 dark:bg-slate-700/60">
                <div className="h-full w-1/2 rounded-full bg-emerald-500/80" />
              </div>
            </div>
            <div className="app-panel-muted rounded-2xl px-4 py-3">
              <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                Revenue booked
              </div>
              <div className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">
                {totalSalesAmount.toLocaleString(undefined, {
                  style: "currency",
                  currency: "USD"
                })}
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-slate-200/70 dark:bg-slate-700/60">
                <div className="h-full w-2/3 rounded-full bg-cyan-500/80" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {isAdminViewer ? (
        <section className="space-y-5">
          <div className="app-panel overflow-hidden rounded-[28px]">
            <div className="relative border-b border-slate-200/70 px-6 py-6 dark:border-slate-800/80 sm:px-8">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.16),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.75),transparent)] dark:bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.18),transparent_34%)]" />
              <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <div className="text-sm font-semibold uppercase tracking-[0.22em] text-sky-600 dark:text-sky-300">
                    Attendance command center
                  </div>
                  <h2 className="mt-3 font-[var(--font-display)] text-2xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-3xl">
                    Team attendance monitor
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-400">
                    Monitor clock-in, clock-out, breaks, live activity, agent health,
                    sleep/inactive signals, and employee reasons from the Executive Dashboard.
                  </p>
                </div>
                <DashboardLiveAttendanceCommandCards initial={initialLiveAttendanceCounts} />
              </div>
            </div>

            <div className="space-y-5 px-4 py-5 sm:px-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                {reportMode === "daily" ? (
                  <>
                    <Link
                      href={`/dashboard?date=${reportPrev}`}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-sky-300 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-sky-600"
                    >
                      Previous day
                    </Link>
                    <Link
                      href={`/dashboard?date=${reportNext}`}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-sky-300 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-sky-600"
                    >
                      Next day
                    </Link>
                    {reportDate !== today ? (
                      <Link
                        href="/dashboard"
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-sky-300 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-sky-600"
                      >
                        Today
                      </Link>
                    ) : null}
                  </>
                ) : (
                  <div className="rounded-xl border border-slate-200/80 bg-white/70 px-4 py-2 text-sm font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
                    Range:{" "}
                    <span className="text-slate-900 dark:text-white">
                      {new Date(normalizedFrom + "T12:00:00").toLocaleDateString()} -{" "}
                      {new Date(normalizedTo + "T12:00:00").toLocaleDateString()}
                    </span>
                  </div>
                )}
                <div className="text-base font-medium text-slate-600 dark:text-slate-400 sm:ml-auto">
                  Date:{" "}
                  <span className="text-slate-900 dark:text-white">
                    {new Date(reportDate + "T12:00:00").toLocaleDateString(undefined, {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric"
                    })}
                  </span>
                </div>
              </div>

              <Suspense
                fallback={
                  <div className="h-24 animate-pulse rounded-2xl border border-slate-200/80 bg-slate-100/80 dark:border-slate-700/70 dark:bg-slate-900/50" />
                }
              >
                <AttendanceReportFilters
                  mode={reportMode}
                  date={reportDate}
                  from={normalizedFrom}
                  to={normalizedTo}
                  preset={presetRaw}
                  search={reportSearch}
                  status={statusFilter}
                  agentState={agentStateFilter}
                  alertsOnly={alertsOnly}
                  departmentId={departmentFilter == null ? "" : String(departmentFilter)}
                  departments={attendanceDepartments}
                  isAdmin={isAdminViewer}
                />
              </Suspense>
            </div>
          </div>

          {attendanceLoadError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
              <strong className="font-semibold">Attendance data failed to load.</strong>{" "}
              <span className="opacity-90">{attendanceLoadError}</span>
            </div>
          ) : null}

          <Suspense
            fallback={
              <div className="data-card px-4 py-8 text-center text-sm text-slate-500">
                Loading attendance monitor...
              </div>
            }
          >
            <AttendanceReportTablesLazy
              detailDate={attendanceDetailDate}
              showAgentHealth={Boolean(attendanceAgentHealth)}
              agentHealth={attendanceAgentHealth}
              agentStateFilter={agentStateFilter}
              agentFilterQueryBase={attendanceBaseQueryParams.toString()}
              basePath="/dashboard"
            />
          </Suspense>
        </section>
      ) : null}

      {session?.role === "employee" ? (
        <section className="data-card">
          <div className="mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Assigned client projects
            </h2>
            <p className="mt-1 text-base text-slate-500 dark:text-slate-400">
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
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                    {item.clientName}
                  </p>
                  <p className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-100">
                    {item.projectName}
                  </p>
                  <p className="mt-2 text-base text-slate-500 dark:text-slate-400">
                    Assigned{" "}
                    {item.assignedAt ? new Date(item.assignedAt).toLocaleDateString() : "recently"}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="metric-card">
          <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            Total leads
          </div>
          <div className="mt-3 text-3xl font-semibold text-slate-950 dark:text-white">
            {totalLeads}
          </div>
          <p className="mt-2 text-base text-slate-500 dark:text-slate-400">
            Combined hot and sales pipeline records.
          </p>
        </div>

        <div className="metric-card">
          <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            Hot leads
          </div>
          <div className="mt-3 text-3xl font-semibold text-sky-600 dark:text-sky-400">
            {Number(hotCount?.value ?? 0)}
          </div>
          <p className="mt-2 text-base text-slate-500 dark:text-slate-400">
            Prioritized follow-up opportunities awaiting action.
          </p>
        </div>

        <div className="metric-card">
          <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            Sales leads
          </div>
          <div className="mt-3 text-3xl font-semibold text-violet-600 dark:text-violet-400">
            {Number(saleCount?.value ?? 0)}
          </div>
          <p className="mt-2 text-base text-slate-500 dark:text-slate-400">
            Records mapped to closing and revenue tracking.
          </p>
        </div>

        <div className="metric-card">
          <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            Open shifts
          </div>
          {isAdminViewer ? (
            <DashboardLiveOpenShiftsMetric initialOpenShifts={activeToday} />
          ) : (
            <>
              <div className="mt-3 text-3xl font-semibold text-emerald-600 dark:text-emerald-400">
                {activeToday}
              </div>
              <p className="mt-2 text-base text-slate-500 dark:text-slate-400">
                Employees currently clocked in and not yet clocked out.
              </p>
            </>
          )}
        </div>
      </section>

      <DashboardChartsLazy
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

  if (isAdminViewer) {
    return (
      <LiveAttendanceCountsProvider initial={initialLiveAttendanceCounts}>
        {dashboardBody}
      </LiveAttendanceCountsProvider>
    );
  }

  return dashboardBody;
}
