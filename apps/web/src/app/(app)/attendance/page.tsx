"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ApiFetchError, apiFetch } from "@/lib/api-fetch";

type AttendanceStatus = "active" | "break" | "offline";

type BreakSessionRow = {
  id: number;
  breakStart: string | null;
  breakEnd: string | null;
};

type Attendance = {
  id: number;
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  totalWorkMinutes: number | null;
  totalBreakMinutes: number | null;
  totalHours?: string | null;
  liveWorkMinutes?: number | null;
  totalHoursLive?: string | null;
  breakSessions?: BreakSessionRow[];
  status: AttendanceStatus;
};

export default function AttendancePage() {
  const [attendance, setAttendance] = useState<Attendance | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const data = await apiFetch<{ attendance?: Attendance | null }>(
        "/api/attendance/me"
      );
      setAttendance(data.attendance ?? null);
      setLastUpdated(new Date());
    } catch (error) {
      if (error instanceof ApiFetchError && error.status !== 401) {
        setError(error.message || "Unable to load attendance for today.");
      } else if (!(error instanceof ApiFetchError)) {
        setError("Unable to load attendance for today.");
      }
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void refresh();
    }, 20000);
    return () => window.clearInterval(id);
  }, [refresh]);

  async function action(path: string) {
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch.post<{ attendance?: Attendance | null }>(path);
      if (result?.attendance) {
        setAttendance((prev) => ({
          ...(prev ?? {}),
          ...result.attendance
        }));
      }
      await refresh();
      const label = path.includes("clock-in")
        ? "Clocked in"
        : path.includes("clock-out")
          ? "Clocked out"
          : path.includes("break-start")
            ? "Break started"
            : path.includes("break-end")
              ? "Break ended"
              : "Saved";
      toast.success(label);
    } catch (error) {
      if (error instanceof ApiFetchError) {
        if (error.status !== 401) setError(error.message);
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  const status = attendance?.status ?? "offline";
  const statusLabel =
    status === "active"
      ? "Active (working)"
      : status === "break"
        ? "On break"
        : "Offline";

  const statusDotClass =
    status === "active"
      ? "bg-emerald-500"
      : status === "break"
        ? "bg-amber-500"
        : "bg-slate-300 dark:bg-slate-600";

  const hoursDisplay =
    attendance?.totalHoursLive ??
    (attendance?.liveWorkMinutes != null
      ? (attendance.liveWorkMinutes / 60).toFixed(2)
      : attendance?.totalWorkMinutes != null
        ? (attendance.totalWorkMinutes / 60).toFixed(2)
        : "—");

  const breaks = attendance?.breakSessions ?? [];

  const shiftOpen = Boolean(
    attendance?.clockIn && !attendance?.clockOut
  );
  const canClockIn =
    !attendance ||
    !attendance.clockIn ||
    Boolean(attendance.clockOut);
  const canClockOut = shiftOpen;
  const canStartBreak =
    shiftOpen && status !== "break";
  const canEndBreak = status === "break";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Attendance
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Tracks working hours, tracks breaks, and shows live status (refreshes
          every 20 seconds while this page is open).
        </p>
        <ul className="mt-2 list-inside list-disc text-xs text-slate-500 dark:text-slate-400">
          <li>Working hours: clock in/out and net work time (minus breaks)</li>
          <li>Breaks: start/end break sessions with running totals</li>
          <li>Live status: Active, Break, or Offline</li>
        </ul>
      </div>
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/35 dark:text-red-300">
          {error}
        </div>
      )}
      <div className="grid gap-6 md:grid-cols-[1.4fr,1.6fr]">
        <div className="data-card min-h-[18.5rem] p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                Live status
              </div>
              <div className="mt-1 flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-full ${statusDotClass}`}
                  title={statusLabel}
                />
                {statusLabel}
              </div>
              {lastUpdated && (
                <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">
                  Updated {lastUpdated.toLocaleTimeString()}
                </p>
              )}
              {attendance?.clockOut && (
                <p className="mt-2 max-w-[14rem] text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                  Shift ended. <strong>Clock in</strong> again to start a new
                  shift today (timer and break list reset for this entry).
                </p>
              )}
            </div>
            <div className="space-x-2">
              <Button
                size="sm"
                variant={canClockIn && !loading ? "default" : "outline"}
                disabled={loading || !canClockIn}
                title={
                  !canClockIn
                    ? "You are already clocked in. Clock out to start a new shift later."
                    : attendance?.clockOut
                      ? "Start a new shift today (previous totals were saved)."
                      : undefined
                }
                onClick={() => action("/api/attendance/clock-in")}
              >
                Clock in
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={loading || !canClockOut}
                title={
                  !canClockOut
                    ? "Clock in first, while your shift is open."
                    : undefined
                }
                onClick={() => action("/api/attendance/clock-out")}
              >
                Clock out
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={loading || !canStartBreak}
              title={
                !canStartBreak
                  ? shiftOpen
                    ? "End your current break before starting another."
                    : "Clock in to start a break."
                  : undefined
              }
              onClick={() => action("/api/attendance/break-start")}
            >
              Start break
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={loading || !canEndBreak}
              title={
                !canEndBreak ? "Start a break first." : undefined
              }
              onClick={() => action("/api/attendance/break-end")}
            >
              End break
            </Button>
          </div>
          <div className="mt-4 space-y-1 text-xs text-slate-600 dark:text-slate-300">
            <div>
              <span className="font-medium text-slate-700 dark:text-slate-200">
                Clock in:
              </span>{" "}
              {attendance?.clockIn
                ? new Date(attendance.clockIn).toLocaleTimeString()
                : "—"}
            </div>
            <div>
              <span className="font-medium text-slate-700 dark:text-slate-200">
                Clock out:
              </span>{" "}
              {attendance?.clockOut
                ? new Date(attendance.clockOut).toLocaleTimeString()
                : "—"}
            </div>
            <div>
              <span className="font-medium text-slate-700 dark:text-slate-200">
                Work (hours):
              </span>{" "}
              {hoursDisplay === "—" ? "—" : `${hoursDisplay} h`}
            </div>
            <div>
              <span className="font-medium text-slate-700 dark:text-slate-200">
                Work (minutes):
              </span>{" "}
              {attendance?.liveWorkMinutes ??
                attendance?.totalWorkMinutes ??
                0}
            </div>
            <div>
              <span className="font-medium text-slate-700 dark:text-slate-200">
                Break minutes (logged):
              </span>{" "}
              {attendance?.totalBreakMinutes ?? 0}
            </div>
          </div>
        </div>
        <div className="data-card min-h-[18.5rem] p-4">
          <div className="mb-3 text-sm font-medium text-slate-900 dark:text-slate-100">
            Breaks today
          </div>
          {breaks.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              No break sessions recorded yet. Use Start break / End break to log
              time away.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full table-auto text-xs">
                <thead>
                  <tr className="border-b border-slate-200/80 text-left uppercase text-slate-500 dark:border-slate-700/80 dark:text-slate-400">
                    <th className="pb-2 pr-2">Start</th>
                    <th className="pb-2 pr-2">End</th>
                    <th className="pb-2">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {breaks.map((b) => {
                    const start = b.breakStart
                      ? new Date(b.breakStart).toLocaleTimeString()
                      : "—";
                    const end = b.breakEnd
                      ? new Date(b.breakEnd).toLocaleTimeString()
                      : "Open";
                    let duration = "—";
                    if (b.breakStart && b.breakEnd) {
                      const mins = Math.round(
                        (new Date(b.breakEnd).getTime() -
                          new Date(b.breakStart).getTime()) /
                          60000
                      );
                      duration = `${mins} min`;
                    } else if (b.breakStart && !b.breakEnd) {
                      const mins = Math.round(
                        (Date.now() - new Date(b.breakStart).getTime()) / 60000
                      );
                      duration = `~${mins} min (ongoing)`;
                    }
                    return (
                      <tr
                        key={b.id}
                        className="border-b border-slate-100/90 last:border-b-0 dark:border-slate-800/90"
                      >
                        <td className="py-2 pr-2 text-slate-700 dark:text-slate-200">
                          {start}
                        </td>
                        <td className="py-2 pr-2 text-slate-700 dark:text-slate-200">
                          {end}
                        </td>
                        <td className="py-2 text-slate-600 dark:text-slate-300">
                          {duration}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-4 text-[10px] text-slate-400 dark:text-slate-500">
            Data model: attendance row (clock in/out, total hours, status) +
            break rows linked by attendance id.
          </p>
        </div>
      </div>
    </div>
  );
}
