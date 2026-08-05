import { cookies } from "next/headers";
import Link from "next/link";
import { Suspense } from "react";
import { Briefcase, Flame, TrendingUp, Gauge } from "lucide-react";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { isAdminRole } from "@/lib/rbac";
import { getLocalDateString } from "@/lib/attendance-date";
import { getAttendanceStatusForDate } from "@/lib/attendance-status-today";
import { DashboardChartsLazy } from "@/components/DashboardChartsLazy";
import { DashboardStatCard } from "@/components/ui/DashboardStatCard";
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
    <div className="space-y-4 sm:space-y-5">
      {dashboardLoadError ? (
        <div
          className="rounded-xl border border-amber-200/90 bg-amber-50/90 px-3 py-3 text-sm leading-relaxed text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100"
          role="alert"
        >
          <p className="font-semibold">Some dashboard data could not be loaded</p>
          <p className="mt-1">{dashboardLoadError}</p>
        </div>
      ) : null}

      {/* Kalie-style overview header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="page-title">Dashboard overview</h1>
          <p className="page-subtitle">
            Welcome back — pipeline, revenue
            {isAdminViewer ? ", and live attendance" : ""} at a glance.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 self-start rounded-full border border-emerald-200/90 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300 sm:self-auto md:text-sm">
          <TrendingUp className="h-4 w-4" aria-hidden />
          <span>Live</span>
        </div>
      </div>

      {/* KPI row — icon cards (Kalie StatCard pattern, brand tones) */}
      <section className="portal-stat-grid" data-testid="dashboard-stat-cards">
        <DashboardStatCard
          title="Total leads"
          value={totalLeads}
          description="Hot + sales pipeline"
          tone="mint"
          icon={<Briefcase className="portal-stat-icon-svg" />}
        />
        <DashboardStatCard
          title="Hot leads"
          value={Number(hotCount?.value ?? 0)}
          description="Priority follow-ups"
          tone="teal"
          icon={<Flame className="portal-stat-icon-svg" />}
        />
        <DashboardStatCard
          title="Sales leads"
          value={Number(saleCount?.value ?? 0)}
          description="Closing / revenue"
          tone="orange"
          icon={<TrendingUp className="portal-stat-icon-svg" />}
        />
        {isAdminViewer ? (
          <div className="portal-stat-card portal-stat-card--gold p-3.5 sm:p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="portal-stat-label portal-stat-label--gold">Open shifts</div>
                <DashboardLiveOpenShiftsMetric initialOpenShifts={activeToday} />
              </div>
              <div className="portal-stat-icon shrink-0 text-[var(--brand-fg)]" aria-hidden>
                <Gauge className="portal-stat-icon-svg" />
              </div>
            </div>
          </div>
        ) : (
          <DashboardStatCard
            title="Open shifts"
            value={activeToday}
            description="Currently clocked in"
            tone="gold"
            icon={<Gauge className="portal-stat-icon-svg" />}
          />
        )}
      </section>

      <section className="dash-card dash-card-pad">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch lg:justify-between">
          <div className="min-w-0 lg:max-w-sm">
            <div className="dash-kicker">Executive overview</div>
            <p className="dash-subtitle mt-2">
              Team size, attendance snapshot, and booked revenue in one strip.
            </p>
          </div>
          <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-3">
            <div className="dash-metric">
              <div className="dash-metric-label">Team members</div>
              <div className="dash-metric-value">{totalUsers}</div>
              <div className="mt-1.5 h-1 rounded-full bg-slate-200/70 dark:bg-slate-700/60">
                <div className="h-full w-3/5 rounded-full bg-brand-500/85" />
              </div>
            </div>
            <div className="dash-metric">
              <div className="dash-metric-label">
                {isAdminViewer ? "Attendance today" : "Attendance"}
              </div>
              {isAdminViewer && liveAttendanceToday ? (
                <DashboardLiveAttendanceSummary initial={initialLiveAttendanceCounts} />
              ) : (
                <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-400">
                  Use the Attendance page for clock-in and breaks.
                </p>
              )}
            </div>
            <div className="dash-metric">
              <div className="dash-metric-label">Revenue booked</div>
              <div className="dash-metric-value">
                {totalSalesAmount.toLocaleString(undefined, {
                  style: "currency",
                  currency: "USD"
                })}
              </div>
              <div className="mt-1.5 h-1 rounded-full bg-slate-200/70 dark:bg-slate-700/60">
                <div className="h-full w-2/3 rounded-full bg-[var(--brand-orange)]/80" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {isAdminViewer ? (
        <section className="space-y-3">
          <div className="dash-card overflow-hidden">
            <div className="relative border-b border-[color-mix(in_srgb,var(--brand-teal-light)_16%,transparent)] px-3 py-3 dark:border-slate-800/80 sm:px-5 sm:py-3.5">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,color-mix(in_srgb,var(--brand-teal-light)_12%,transparent),transparent_36%)]" />
              <div className="relative flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                <div className="min-w-0">
                  <div className="dash-kicker">Attendance command center</div>
                  <h2 className="dash-title-lg mt-1">Team attendance monitor</h2>
                  <p className="dash-subtitle mt-1 max-w-2xl">
                    Clock-in, breaks, agent health, sleep — double-click a row for detail.
                  </p>
                </div>
                <DashboardLiveAttendanceCommandCards initial={initialLiveAttendanceCounts} />
              </div>
            </div>

            <div className="space-y-3 px-3 py-3 sm:px-4 sm:py-3.5">
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                {reportMode === "daily" ? (
                  <>
                    <Link
                      href={`/dashboard?date=${reportPrev}`}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:border-brand-300 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-brand-600"
                    >
                      Previous day
                    </Link>
                    <Link
                      href={`/dashboard?date=${reportNext}`}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:border-brand-300 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-brand-600"
                    >
                      Next day
                    </Link>
                    {reportDate !== today ? (
                      <Link
                        href="/dashboard"
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:border-brand-300 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-brand-600"
                      >
                        Today
                      </Link>
                    ) : null}
                  </>
                ) : (
                  <div className="rounded-lg border border-slate-200/80 bg-white/70 px-3 py-1.5 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
                    Range:{" "}
                    <span className="text-slate-900 dark:text-white">
                      {new Date(normalizedFrom + "T12:00:00").toLocaleDateString()} -{" "}
                      {new Date(normalizedTo + "T12:00:00").toLocaleDateString()}
                    </span>
                  </div>
                )}
                <div className="text-xs font-medium text-slate-600 dark:text-slate-400 sm:ml-auto sm:text-sm">
                  Date:{" "}
                  <span className="text-slate-900 dark:text-white">
                    {new Date(reportDate + "T12:00:00").toLocaleDateString(undefined, {
                      weekday: "short",
                      year: "numeric",
                      month: "short",
                      day: "numeric"
                    })}
                  </span>
                </div>
              </div>

              <Suspense
                fallback={
                  <div className="h-16 animate-pulse rounded-xl border border-slate-200/80 bg-slate-100/80 dark:border-slate-700/70 dark:bg-slate-900/50" />
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
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
              <strong className="font-semibold">Attendance data failed to load.</strong>{" "}
              <span className="opacity-90">{attendanceLoadError}</span>
            </div>
          ) : null}

          <Suspense
            fallback={
              <div className="data-card px-4 py-6 text-center text-sm text-slate-500">
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
          <div className="mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
              Assigned client projects
            </h2>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              Projects assigned to your account.
            </p>
          </div>
          {assignedClientProjects.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-500 dark:border-slate-700">
              No client project assigned yet.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {assignedClientProjects.map((item) => (
                <article
                  key={item.assignmentId}
                  className="rounded-lg border border-slate-200/80 bg-white px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900/70"
                >
                  <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                    {item.clientName}
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
                    {item.projectName}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Assigned{" "}
                    {item.assignedAt ? new Date(item.assignedAt).toLocaleDateString() : "recently"}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}

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
