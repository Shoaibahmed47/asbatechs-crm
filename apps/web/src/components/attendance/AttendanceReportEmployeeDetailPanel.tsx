"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";

import {
  AttendanceDateRangeCalendar,
  formatAttendanceRangeLabel
} from "@/components/attendance/AttendanceDateRangeCalendar";
import { TablePagination } from "@/components/TablePagination";
import { Button } from "@/components/ui/button";
import { ApiFetchError, apiFetch } from "@/lib/api-fetch";
import type { AttendanceEmployeeDetail } from "@/lib/attendance-employee-detail";
import { cn } from "@/lib/utils";

type Props = {
  userId: number;
  userName: string;
  date: string;
  onClose: () => void;
};

function formatClock(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatMinutes(m: number | null | undefined): string {
  if (m == null || Number.isNaN(m)) return "—";
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}h ${mm}m`;
}

function formatAge(seconds: number | null): string {
  if (seconds == null) return "Never";
  if (seconds < 60) return `${seconds}s ago`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function toneForStatus(status: string): string {
  if (status === "active") return "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300";
  if (status === "break") return "bg-amber-500/15 text-amber-900 dark:text-amber-300";
  if (status === "idle") return "bg-rose-500/15 text-rose-800 dark:text-rose-300";
  return "bg-slate-200/80 text-slate-700 dark:bg-slate-800 dark:text-slate-400";
}

function toneForAgent(state: string): string {
  if (state === "running") return "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300";
  if (state === "installed") return "bg-sky-500/15 text-sky-800 dark:text-sky-300";
  if (state === "stale") return "bg-amber-500/15 text-amber-900 dark:text-amber-300";
  return "bg-slate-200/80 text-slate-700 dark:bg-slate-800 dark:text-slate-400";
}

function agentStateHint(state: string): string {
  if (state === "running") return "Live monitoring is active.";
  if (state === "installed") return "Setup done, waiting for fresh signal.";
  if (state === "stale") return "No recent activity signal from agent.";
  return "Agent setup not installed on this machine.";
}

function formatDayHeading(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

function DetailStatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/90 px-3 py-3 shadow-sm dark:border-slate-700/90 dark:from-slate-900/80 dark:to-slate-950/50">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div className="mt-1.5 text-sm font-semibold leading-snug tabular-nums text-slate-900 dark:text-slate-100">
        {value}
      </div>
    </div>
  );
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function AttendanceReportEmployeeDetailPanel({
  userId,
  userName,
  date,
  onClose
}: Props) {
  const [detail, setDetail] = useState<AttendanceEmployeeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState(date);
  const [dateTo, setDateTo] = useState(date);
  const [activeDate, setActiveDate] = useState(date);
  const [breakPage, setBreakPage] = useState(1);
  const [breakLimit, setBreakLimit] = useState(10);

  const isMultiDayRange = dateFrom !== dateTo;

  const breakSessionsSorted = useMemo(() => {
    if (!detail?.breakSessions) return [];
    return [...detail.breakSessions].sort(
      (a, b) => new Date(b.breakStart).getTime() - new Date(a.breakStart).getTime()
    );
  }, [detail?.breakSessions]);

  const breakTotalPages =
    breakSessionsSorted.length === 0 ? 0 : Math.ceil(breakSessionsSorted.length / breakLimit);

  const paginatedBreakSessions = useMemo(() => {
    const start = (breakPage - 1) * breakLimit;
    return breakSessionsSorted.slice(start, start + breakLimit);
  }, [breakSessionsSorted, breakPage, breakLimit]);

  const copyReport = useCallback(async () => {
    if (!detail) return;
    const lines = [
      `Attendance Detail - ${userName}`,
      `Email: ${detail.userEmail}`,
      `Date: ${activeDate}`,
      `Status: ${detail.attendanceStatus}`,
      `Reason: ${detail.attendanceReason}`,
      `Clock in: ${formatClock(detail.clockIn)}`,
      `Clock out: ${formatClock(detail.clockOut)}`,
      `Work: ${formatMinutes(detail.totalWorkMinutes)}`,
      `Break: ${formatMinutes(detail.totalBreakMinutes)}`,
      `Idle: ${formatMinutes(detail.unscheduledIdleMinutes)}`,
      `Sleep: ${formatMinutes(detail.sleepMinutes)}`,
      `Total hours: ${detail.totalHours != null ? `${detail.totalHours} h` : "—"}`,
      `Break sessions: ${breakSessionsSorted.length}`
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      toast.success("Report copied");
    } catch {
      toast.error("Could not copy report");
    }
  }, [activeDate, breakSessionsSorted.length, detail, userName]);

  const downloadReport = useCallback(() => {
    if (!detail) return;
    const payload = {
      generatedAt: new Date().toISOString(),
      userName,
      activeDate,
      dateFrom,
      dateTo,
      detail,
      breakSessions: breakSessionsSorted
    };
    try {
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json;charset=utf-8"
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `attendance-${userName.replaceAll(/\s+/g, "-").toLowerCase()}-${activeDate}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Report downloaded");
    } catch {
      toast.error("Could not download report");
    }
  }, [activeDate, breakSessionsSorted, dateFrom, dateTo, detail, userName]);

  const exportPdf = useCallback(() => {
    if (!detail) return;
    const rowsHtml = breakSessionsSorted
      .map((row) => {
        const start = formatClock(row.breakStart);
        const end = row.breakEnd ? formatClock(row.breakEnd) : "Open";
        const duration =
          row.durationMinutes != null
            ? `${row.durationMinutes} min`
            : row.breakEnd
              ? "—"
              : "Ongoing";
        return `<tr>
          <td>${escapeHtml(String(row.logDate ?? activeDate))}</td>
          <td>${escapeHtml(start)}</td>
          <td>${escapeHtml(end)}</td>
          <td>${escapeHtml(duration)}</td>
          <td>${escapeHtml(String(row.breakType ?? "—"))}</td>
          <td>${escapeHtml(String(row.unscheduledCause ?? "—"))}</td>
          <td>${escapeHtml(String(row.returnReason?.trim() || "—"))}</td>
          <td>${escapeHtml(String(row.reasonLabel ?? "—"))}</td>
        </tr>`;
      })
      .join("");

    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Attendance Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #0f172a; }
    h1 { margin: 0 0 6px; }
    p { margin: 0 0 6px; }
    .section { margin-top: 18px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; vertical-align: top; }
    th { background: #f1f5f9; }
  </style>
</head>
<body>
  <h1>Attendance Detail</h1>
  <p><strong>Name:</strong> ${escapeHtml(userName)}</p>
  <p><strong>Email:</strong> ${escapeHtml(detail.userEmail)}</p>
  <p><strong>Date:</strong> ${escapeHtml(activeDate)}</p>

  <div class="section">
    <p><strong>Status:</strong> ${escapeHtml(detail.attendanceStatus)}</p>
    <p><strong>Reason:</strong> ${escapeHtml(detail.attendanceReason)}</p>
    <p><strong>Clock in:</strong> ${escapeHtml(formatClock(detail.clockIn))}</p>
    <p><strong>Clock out:</strong> ${escapeHtml(formatClock(detail.clockOut))}</p>
    <p><strong>Work:</strong> ${escapeHtml(formatMinutes(detail.totalWorkMinutes))}</p>
    <p><strong>Break:</strong> ${escapeHtml(formatMinutes(detail.totalBreakMinutes))}</p>
    <p><strong>Idle:</strong> ${escapeHtml(formatMinutes(detail.unscheduledIdleMinutes))}</p>
    <p><strong>Sleep:</strong> ${escapeHtml(formatMinutes(detail.sleepMinutes))}</p>
    <p><strong>Total hours:</strong> ${escapeHtml(
      detail.totalHours != null ? `${detail.totalHours} h` : "—"
    )}</p>
  </div>

  <div class="section">
    <h3>Break Sessions</h3>
    <table>
      <thead>
        <tr>
          <th>Date</th><th>Start</th><th>End</th><th>Duration</th><th>Type</th><th>Cause</th><th>Return</th><th>Label</th>
        </tr>
      </thead>
      <tbody>${rowsHtml || "<tr><td colspan='8'>No sessions</td></tr>"}</tbody>
    </table>
  </div>
</body>
</html>`;

    try {
      const win = window.open("", "_blank", "width=1100,height=800");
      if (!win || !win.document) {
        toast.error("Pop-up blocked. Allow pop-ups to export PDF.");
        return;
      }
      win.document.open();
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => {
        try {
          win.print();
        } catch {
          toast.error("Could not open print dialog.");
        }
      }, 300);
    } catch {
      toast.error("Export PDF failed. Please try again.");
    }
  }, [activeDate, breakSessionsSorted, detail, userName]);

  useEffect(() => {
    setDateFrom(date);
    setDateTo(date);
    setActiveDate(date);
    setBreakPage(1);
  }, [date, userId]);

  useEffect(() => {
    setBreakPage(1);
  }, [dateFrom, dateTo]);

  useEffect(() => {
    if (breakTotalPages > 0 && breakPage > breakTotalPages) {
      setBreakPage(breakTotalPages);
    }
  }, [breakPage, breakTotalPages]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({
        userId: String(userId),
        date: activeDate,
        from: dateFrom,
        to: dateTo
      });
      const data = await apiFetch<{ detail: AttendanceEmployeeDetail }>(
        `/api/admin/attendance/employee-detail?${q.toString()}`
      );
      setDetail(data.detail);
    } catch (err) {
      if (err instanceof ApiFetchError) {
        setError(err.message || "Could not load employee attendance.");
      } else {
        setError("Could not load employee attendance.");
      }
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [userId, activeDate, dateFrom, dateTo]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]"
        aria-label="Close employee detail"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="attendance-detail-title"
        className="app-panel relative z-10 flex h-full w-[min(96vw,56rem)] shrink-0 flex-col rounded-none border-l border-slate-200/90 shadow-2xl dark:border-slate-700 xl:w-[min(92vw,62rem)]"
      >
        <header className="shrink-0 border-b border-slate-200/90 px-6 py-5 dark:border-slate-800">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-600 dark:text-sky-300">
                Attendance detail
              </p>
              <h2
                id="attendance-detail-title"
                className="page-title mt-2 text-2xl sm:text-3xl"
              >
                {userName}
              </h2>
              <p className="page-subtitle mt-1 max-w-none text-sm">
                {detail?.userEmail ?? "Loading…"}
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  Day: {formatDayHeading(activeDate)}
                </span>
                {isMultiDayRange ? (
                  <span className="rounded-full bg-sky-100 px-2.5 py-1 font-medium text-sky-800 dark:bg-sky-950/50 dark:text-sky-200">
                    Breaks: {formatAttendanceRangeLabel(dateFrom, dateTo)}
                  </span>
                ) : null}
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onClose}
              aria-label="Close"
              className="shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="flex min-h-[28rem] items-center justify-center">
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200/90 bg-white/80 px-8 py-7 shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
                <Loader2 className="h-14 w-14 animate-spin text-slate-500/80 dark:text-slate-300/70" />
                <p className="text-base font-semibold text-slate-900 dark:text-slate-100">Loading...</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Loading attendance data</p>
              </div>
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
              {error}
            </div>
          ) : detail ? (
            <div className="space-y-5">
              <section className="data-card p-4 sm:p-5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Current status
                </h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span
                    className={cn(
                      "inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase",
                      toneForStatus(detail.attendanceStatus)
                    )}
                  >
                    {detail.attendanceStatus}
                  </span>
                  <span
                    className={cn(
                      "inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase",
                      toneForAgent(detail.agentState)
                    )}
                  >
                    Agent: {detail.agentStateLabel}
                  </span>
                  <span className="inline-flex rounded-full bg-slate-200/80 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    Shift: {detail.openShift ? "Open" : "Closed"}
                  </span>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-slate-800 dark:text-slate-200">
                  <span className="font-semibold text-slate-600 dark:text-slate-400">Reason: </span>
                  {detail.attendanceReason}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {agentStateHint(detail.agentState)}
                </p>
                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/60">
                    <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">Email</dt>
                    <dd className="mt-0.5 break-all font-medium text-slate-900 dark:text-slate-100">
                      {detail.userEmail}
                    </dd>
                  </div>
                  <div className="rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/60">
                    <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Department
                    </dt>
                    <dd className="mt-0.5 font-medium text-slate-900 dark:text-slate-100">
                      {detail.departmentName ?? "—"}
                    </dd>
                  </div>
                  <div className="rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/60">
                    <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Last agent heartbeat
                    </dt>
                    <dd className="mt-0.5 font-medium text-slate-900 dark:text-slate-100">
                      {detail.lastAgentActivityAt
                        ? formatClock(detail.lastAgentActivityAt)
                        : "—"}{" "}
                      <span className="text-slate-500">({formatAge(detail.lastAgentAgeSeconds)})</span>
                    </dd>
                  </div>
                  <div className="rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/60">
                    <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Last activity
                    </dt>
                    <dd className="mt-0.5 font-medium text-slate-900 dark:text-slate-100">
                      {detail.lastActivityAt ? formatClock(detail.lastActivityAt) : "—"}
                      {detail.lastActivitySource ? ` · ${detail.lastActivitySource}` : ""}
                    </dd>
                  </div>
                </dl>
              </section>

              <section className="data-card p-4 sm:p-5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Day totals
                </h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Metrics for <strong className="text-slate-900 dark:text-slate-100">{activeDate}</strong>
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  <DetailStatTile label="Clock in" value={formatClock(detail.clockIn)} />
                  <DetailStatTile label="Clock out" value={formatClock(detail.clockOut)} />
                  <DetailStatTile label="Work" value={formatMinutes(detail.totalWorkMinutes)} />
                  <DetailStatTile label="Break" value={formatMinutes(detail.totalBreakMinutes)} />
                  <DetailStatTile label="Idle" value={formatMinutes(detail.unscheduledIdleMinutes)} />
                  <DetailStatTile label="Sleep" value={formatMinutes(detail.sleepMinutes)} />
                  <DetailStatTile label="Idle events" value={String(detail.idleEventsCount)} />
                  <DetailStatTile label="Sleep events" value={String(detail.sleepEventsCount)} />
                  <DetailStatTile
                    label="Total hours"
                    value={detail.totalHours != null ? `${detail.totalHours} h` : "—"}
                  />
                </div>
              </section>

              <section className="data-card p-4 sm:p-5">
                <AttendanceDateRangeCalendar
                  variant="compact"
                  display="inline"
                  autoApply
                  numberOfMonths={2}
                  from={dateFrom}
                  to={dateTo}
                  activeDate={activeDate}
                  onRangeChange={(from, to) => {
                    setDateFrom(from);
                    setDateTo(to);
                    setActiveDate(to);
                    setBreakPage(1);
                  }}
                  onActiveDateChange={setActiveDate}
                  headerStart={
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Break sessions & reasons
                      </h3>
                      <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
                        {breakSessionsSorted.length}{" "}
                        {breakSessionsSorted.length === 1 ? "session" : "sessions"}
                        {isMultiDayRange
                          ? ` · ${formatAttendanceRangeLabel(dateFrom, dateTo)}`
                          : ` · ${activeDate}`}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Day totals above are for {activeDate} only.
                      </p>
                    </div>
                  }
                />

                {breakSessionsSorted.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                    {isMultiDayRange
                      ? "No break sessions in this date range."
                      : detail.hasLog
                        ? "No break sessions recorded for this date."
                        : "No attendance log for this date."}
                  </p>
                ) : (
                  <div className="mt-4 flex flex-col">
                    <div className="overflow-x-auto rounded-xl border border-slate-200/90 dark:border-slate-700">
                      <table className="w-full min-w-[32rem] text-left text-sm">
                        <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-900/90 dark:text-slate-400">
                          <tr>
                            {isMultiDayRange ? <th className="px-3 py-2.5">Date</th> : null}
                            <th className="px-3 py-2.5">Start</th>
                            <th className="px-3 py-2.5">End</th>
                            <th className="px-3 py-2.5">Duration</th>
                            <th className="px-3 py-2.5">Type</th>
                            <th className="px-3 py-2.5">Cause</th>
                            <th className="px-3 py-2.5">Return</th>
                            <th className="px-3 py-2.5">Label</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {paginatedBreakSessions.map((row) => (
                            <tr
                              key={`${row.logDate}-${row.id}`}
                              className="bg-white/50 dark:bg-slate-950/30"
                            >
                            {isMultiDayRange ? (
                              <td className="whitespace-nowrap px-3 py-2.5 font-medium text-slate-800 dark:text-slate-200">
                                {row.logDate}
                              </td>
                            ) : null}
                            <td className="whitespace-nowrap px-3 py-2.5 text-slate-700 dark:text-slate-200">
                              {formatClock(row.breakStart)}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-slate-700 dark:text-slate-200">
                              {row.breakEnd ? formatClock(row.breakEnd) : "Open"}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-slate-600 dark:text-slate-300">
                              {row.durationMinutes != null
                                ? `${row.durationMinutes} min`
                                : row.breakEnd
                                  ? "—"
                                  : "Ongoing"}
                            </td>
                            <td className="px-3 py-2.5 capitalize text-slate-700 dark:text-slate-200">
                              {row.breakType}
                            </td>
                            <td className="px-3 py-2.5 text-slate-700 dark:text-slate-200">
                              {row.unscheduledCause ?? "—"}
                            </td>
                            <td className="max-w-[8rem] truncate px-3 py-2.5 text-slate-700 dark:text-slate-200">
                              {row.returnReason?.trim() ? row.returnReason : "—"}
                            </td>
                            <td className="px-3 py-2.5 font-medium text-slate-800 dark:text-slate-100">
                              {row.reasonLabel}
                            </td>
                          </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <TablePagination
                      className="mt-3 shrink-0 border-t-0 pt-0"
                      page={breakPage}
                      totalPages={breakTotalPages}
                      total={breakSessionsSorted.length}
                      limit={breakLimit}
                      onPageChange={setBreakPage}
                      onLimitChange={(n) => {
                        setBreakLimit(n);
                        setBreakPage(1);
                      }}
                      limitOptions={[5, 10, 15, 25]}
                    />
                  </div>
                )}
              </section>
            </div>
          ) : null}
        </div>

        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200/90 px-6 py-4 dark:border-slate-800">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Scroll this panel to see all sections.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => void copyReport()} disabled={loading || !detail}>
              Copy report
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => downloadReport()} disabled={loading || !detail}>
              Download
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => exportPdf()} disabled={loading || !detail}>
              Export PDF
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
              Refresh
            </Button>
          </div>
        </footer>
      </aside>
    </div>
  );
}

