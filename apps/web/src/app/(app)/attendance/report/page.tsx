import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { getLocalDateString } from "@/lib/attendance-date";
import { getAttendanceDailyReport } from "@/lib/attendance-daily-report";
import { isAdminRole, isManagerRole } from "@/lib/rbac";

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
  const date =
    dateRaw && /^\d{4}-\d{2}-\d{2}$/.test(dateRaw) ? dateRaw : getLocalDateString();

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
  let loadError: string | null = null;
  try {
    rows = await getAttendanceDailyReport(date, {
      role: isAdminRole(session.role) ? "admin" : "manager",
      departmentId: session.departmentId
    });
  } catch (err) {
    console.error("[attendance/report]", err);
    loadError =
      err instanceof Error
        ? err.message
        : "Could not load attendance data. Check the database connection and migrations.";
  }

  const today = getLocalDateString();
  const prev = shiftDate(date, -1);
  const next = shiftDate(date, 1);
  const scopeLabel = isAdminRole(session.role) ? "All users" : "Your department";

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

        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    No people in scope for this report.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
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
        </div>
      </section>
    </div>
  );
}
