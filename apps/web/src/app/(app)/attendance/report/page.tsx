import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { asc } from "drizzle-orm";

import { COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { getLocalDateString } from "@/lib/attendance-date";
import {
  getAttendanceDailyReport,
  getAttendanceRangeReport
} from "@/lib/attendance-daily-report";
import { isAdminRole, isManagerRole } from "@/lib/rbac";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { AttendanceReportFilters } from "./AttendanceReportFilters";

export const dynamic = "force-dynamic";

function shiftDate(iso: string, deltaDays: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() + deltaDays);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function formatMinutes(m: number | null | undefined): string {
  if (m == null || Number.isNaN(m)) return "—";
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}h ${mm}m`;
}

function formatClock(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function pickDateParam(value: string | string[] | undefined): string | undefined {
  if (value == null) return undefined;
  const s = Array.isArray(value) ? value[0] : value;
  return typeof s === "string" ? s : undefined;
}

function getAttendanceStatus(row: {
  hasLog: boolean;
  clockIn: string | null;
  clockOut: string | null;
}): "present" | "working" | "absent" {
  if (!row.hasLog) return "absent";
  if (row.clockIn && !row.clockOut) return "working";
  return "present";
}

function shiftByDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00`);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function getRangeFromPreset(preset: string, today: string): { from: string; to: string } {
  const now = new Date(`${today}T00:00:00`);
  const year = now.getFullYear();
  const month = now.getMonth();
  if (preset === "last_7_days") return { from: shiftByDays(today, -6), to: today };
  if (preset === "last_14_days") return { from: shiftByDays(today, -13), to: today };
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

export default async function AttendanceReportPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const session = token ? await verifyAuthToken(token) : null;

  if (!session || (!isAdminRole(session.role) && !isManagerRole(session.role))) {
    redirect("/dashboard");
  }

  const sp = (await Promise.resolve(searchParams)) ?? {};
  const dateRaw = pickDateParam(sp.date);
  const modeRaw = (pickDateParam(sp.mode) ?? "daily").toLowerCase();
  const mode = modeRaw === "range" ? "range" : "daily";
  const presetRaw = (pickDateParam(sp.preset) ?? "").toLowerCase();
  const search = (pickDateParam(sp.search) ?? "").trim();
  const statusRaw = (pickDateParam(sp.status) ?? "").toLowerCase();
  const departmentRaw = pickDateParam(sp.departmentId);
  const statusFilter =
    statusRaw === "present" || statusRaw === "working" || statusRaw === "absent"
      ? statusRaw
      : "all";
  const departmentFilter =
    departmentRaw && /^\d+$/.test(departmentRaw) ? Number(departmentRaw) : null;
  const date =
    dateRaw && /^\d{4}-\d{2}-\d{2}$/.test(dateRaw) ? dateRaw : getLocalDateString();
  const fromRaw = pickDateParam(sp.from);
  const toRaw = pickDateParam(sp.to);
  const today = getLocalDateString();
  const presetRange =
    presetRaw === "last_7_days" ||
    presetRaw === "last_14_days" ||
    presetRaw === "last_month"
      ? getRangeFromPreset(presetRaw, today)
      : null;
  const fromDate =
    presetRange?.from ??
    (fromRaw && /^\d{4}-\d{2}-\d{2}$/.test(fromRaw) ? fromRaw : date);
  const toDate =
    presetRange?.to ?? (toRaw && /^\d{4}-\d{2}-\d{2}$/.test(toRaw) ? toRaw : date);
  const normalizedFrom = fromDate <= toDate ? fromDate : toDate;
  const normalizedTo = fromDate <= toDate ? toDate : fromDate;

  if (isManagerRole(session.role) && session.departmentId == null) {
    return (
      <div className="app-panel rounded-[28px] px-6 py-8">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
          Attendance report
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Your account has no department assigned. Ask an administrator to assign you to a
          department to view team attendance.
        </p>
      </div>
    );
  }

  let rows: Awaited<ReturnType<typeof getAttendanceDailyReport>> = [];
  let rangeRows: Awaited<ReturnType<typeof getAttendanceRangeReport>> = [];
  let loadError: string | null = null;
  try {
    if (mode === "range") {
      rangeRows = await getAttendanceRangeReport(normalizedFrom, normalizedTo, {
        role: isAdminRole(session.role) ? "admin" : "manager",
        departmentId: session.departmentId
      });
    } else {
      rows = await getAttendanceDailyReport(date, {
        role: isAdminRole(session.role) ? "admin" : "manager",
        departmentId: session.departmentId
      });
    }
  } catch (err) {
    console.error("[attendance/report]", err);
    loadError =
      err instanceof Error
        ? err.message
        : "Could not load attendance data. Check the database connection and migrations.";
  }

  const prev = shiftDate(date, -1);
  const next = shiftDate(date, 1);
  const scopeLabel = isAdminRole(session.role) ? "All users" : "Your department";
  const departments = isAdminRole(session.role)
    ? await db
        .select({ id: schema.departments.id, name: schema.departments.name })
        .from(schema.departments)
        .orderBy(asc(schema.departments.name))
    : [];
  const filteredRows = rows.filter((row) => {
    const matchesSearch =
      search.length === 0 ||
      row.userName.toLowerCase().includes(search.toLowerCase()) ||
      row.userEmail.toLowerCase().includes(search.toLowerCase());
    const rowStatus = getAttendanceStatus(row);
    const matchesStatus = statusFilter === "all" || rowStatus === statusFilter;
    const matchesDepartment = departmentFilter == null || row.departmentId === departmentFilter;
    return matchesSearch && matchesStatus && matchesDepartment;
  });
  const filteredRangeRows = rangeRows.filter((row) => {
    const matchesSearch =
      search.length === 0 ||
      row.userName.toLowerCase().includes(search.toLowerCase()) ||
      row.userEmail.toLowerCase().includes(search.toLowerCase());
    const matchesDepartment = departmentFilter == null || row.departmentId === departmentFilter;
    return matchesSearch && matchesDepartment;
  });
  return (
    <div className="space-y-6">
      <section className="app-panel rounded-[28px] px-6 py-7 sm:px-8">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-600 dark:text-sky-300">
          Reporting
        </div>
        <h1 className="page-title mt-3">Attendance by day</h1>
        <p className="page-subtitle">
          Per-user clock times, net work, and break totals for the selected date ({scopeLabel}
          ).
        </p>

        <div className="mt-6 flex flex-col gap-4">
          {mode === "daily" ? (
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/attendance/report?date=${prev}`}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-sky-300 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-sky-600"
              >
                Previous day
              </Link>
              <Link
                href={`/attendance/report?date=${next}`}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-sky-300 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-sky-600"
              >
                Next day
              </Link>
              {date !== today ? (
                <Link
                  href="/attendance/report"
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-sky-300 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-sky-600"
                >
                  Today
                </Link>
              ) : null}
            </div>
          ) : (
            <div className="text-sm font-medium text-slate-600 dark:text-slate-400">
              Range:{" "}
              <span className="text-slate-900 dark:text-white">
                {new Date(normalizedFrom + "T12:00:00").toLocaleDateString()} -{" "}
                {new Date(normalizedTo + "T12:00:00").toLocaleDateString()}
              </span>
            </div>
          )}
          <div className="text-sm font-medium text-slate-600 dark:text-slate-400">
            Date:{" "}
            <span className="text-slate-900 dark:text-white">
              {new Date(date + "T12:00:00").toLocaleDateString(undefined, {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric"
              })}
            </span>
          </div>
          <AttendanceReportFilters
            mode={mode}
            date={date}
            from={normalizedFrom}
            to={normalizedTo}
            preset={presetRaw}
            search={search}
            status={statusFilter}
            departmentId={departmentFilter == null ? "" : String(departmentFilter)}
            departments={departments}
            isAdmin={isAdminRole(session.role)}
          />
        </div>
      </section>

      {loadError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          <strong className="font-semibold">Report failed to load.</strong>{" "}
          <span className="opacity-90">{loadError}</span>
        </div>
      ) : null}

      <section className="data-card overflow-hidden p-0">
        <div className="max-h-[min(70vh,40rem)] overflow-auto">
          {mode === "range" ? (
            <table className="w-full min-w-[48rem] text-left text-sm">
              <thead className="sticky top-0 z-[1] bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-900/95 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3 text-right">Present days</th>
                  <th className="px-4 py-3 text-right">Absent days</th>
                  <th className="px-4 py-3 text-right">Work</th>
                  <th className="px-4 py-3 text-right">Break</th>
                  <th className="px-4 py-3 text-right">Total hours</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loadError ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                      Fix the error above and refresh the page.
                    </td>
                  </tr>
                ) : filteredRangeRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                      No matching employees for current filters.
                    </td>
                  </tr>
                ) : (
                  filteredRangeRows.map((r) => (
                    <tr
                      key={r.userId}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                    >
                      <td className="whitespace-nowrap px-4 py-2.5 font-medium text-slate-900 dark:text-slate-100">
                        {r.userName}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">
                        {r.userEmail}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-300">
                        {r.presentDays}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-300">
                        {r.absentDays}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-300">
                        {formatMinutes(r.totalWorkMinutes)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-300">
                        {formatMinutes(r.totalBreakMinutes)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-300">
                        {r.totalHours} h
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full min-w-[48rem] text-left text-sm">
            <thead className="sticky top-0 z-[1] bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-900/95 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Clock in</th>
                <th className="px-4 py-3">Clock out</th>
                <th className="px-4 py-3 text-right">Work</th>
                <th className="px-4 py-3 text-right">Break</th>
                <th className="px-4 py-3 text-right">Total hours</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loadError ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    Fix the error above and refresh the page.
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    No matching employees for current filters.
                  </td>
                </tr>
              ) : (
                filteredRows.map((r) => (
                  <tr
                    key={r.userId}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                  >
                    <td className="whitespace-nowrap px-4 py-2.5 font-medium text-slate-900 dark:text-slate-100">
                      {r.userName}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">
                      {r.userEmail}
                    </td>
                    <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300">
                      {formatClock(r.clockIn)}
                    </td>
                    <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300">
                      {formatClock(r.clockOut)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-300">
                      {r.hasLog ? formatMinutes(r.totalWorkMinutes ?? 0) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-300">
                      {r.hasLog ? formatMinutes(r.totalBreakMinutes ?? 0) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-300">
                      {r.totalHours != null ? `${r.totalHours} h` : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
