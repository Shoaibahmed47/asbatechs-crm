"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type AttendanceStatus = "active" | "on_break" | "offline";

type Attendance = {
  id: number;
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  totalWorkMinutes: number | null;
  totalBreakMinutes: number | null;
  status: AttendanceStatus;
};

export default function AttendancePage() {
  const [attendance, setAttendance] = useState<Attendance | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setError(null);
    const res = await fetch("/api/attendance/me");
    if (!res.ok) {
      setError("Unable to load attendance for today.");
      return;
    }
    const data = await res.json();
    setAttendance(data.attendance);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function action(path: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(path, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Action failed.");
      } else {
        await refresh();
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const statusLabel =
    attendance?.status === "active"
      ? "Active"
      : attendance?.status === "on_break"
      ? "On break"
      : "Offline";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Attendance</h1>
        <p className="mt-1 text-sm text-slate-600">
          Clock in/out and manage your breaks for today.
        </p>
      </div>
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}
      <div className="grid gap-6 md:grid-cols-[1.4fr,1.6fr]">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold uppercase text-slate-500">
                Today&apos;s status
              </div>
              <div className="mt-1 text-lg font-semibold text-slate-900">
                {statusLabel}
              </div>
            </div>
            <div className="space-x-2">
              <Button
                size="sm"
                variant="outline"
                disabled={loading}
                onClick={() => action("/api/attendance/clock-in")}
              >
                Clock in
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={loading}
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
              disabled={loading}
              onClick={() => action("/api/attendance/break-start")}
            >
              Start break
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={loading}
              onClick={() => action("/api/attendance/break-end")}
            >
              End break
            </Button>
          </div>
          <div className="mt-4 space-y-1 text-xs text-slate-600">
            <div>
              <span className="font-medium text-slate-700">Clock in:</span>{" "}
              {attendance?.clockIn
                ? new Date(attendance.clockIn).toLocaleTimeString()
                : "—"}
            </div>
            <div>
              <span className="font-medium text-slate-700">Clock out:</span>{" "}
              {attendance?.clockOut
                ? new Date(attendance.clockOut).toLocaleTimeString()
                : "—"}
            </div>
            <div>
              <span className="font-medium text-slate-700">Work minutes:</span>{" "}
              {attendance?.totalWorkMinutes ?? 0}
            </div>
            <div>
              <span className="font-medium text-slate-700">
                Break minutes:
              </span>{" "}
              {attendance?.totalBreakMinutes ?? 0}
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3 text-sm font-medium text-slate-900">
            Today summary
          </div>
          <p className="text-xs text-slate-600">
            This area can be extended with detailed timelines and admin-level
            visibility for who is active, on break, or offline across the team.
          </p>
        </div>
      </div>
    </div>
  );
}

