"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode
} from "react";
import { apiFetch } from "@/lib/api-fetch";

const POLL_MS = 20_000;

export type LiveAttendanceCounts = {
  active: number;
  onBreak: number;
  offline: number;
  openShifts: number;
};

type StatusTodayResponse = {
  counts?: {
    active?: number;
    onBreak?: number;
    offline?: number;
  };
  people?: Array<{
    status?: string;
    clockIn?: string | null;
    clockOut?: string | null;
  }>;
};

const LiveAttendanceCountsContext = createContext<LiveAttendanceCounts | null>(null);

function countsFromPayload(data: StatusTodayResponse): LiveAttendanceCounts {
  const people = data.people ?? [];
  const openShifts = people.filter((person) => Boolean(person.clockIn) && !person.clockOut)
    .length;

  return {
    active: data.counts?.active ?? people.filter((p) => p.status === "active").length,
    onBreak: data.counts?.onBreak ?? people.filter((p) => p.status === "break").length,
    offline: data.counts?.offline ?? people.filter((p) => p.status === "offline").length,
    openShifts
  };
}

export function LiveAttendanceCountsProvider({
  initial,
  children
}: {
  initial: LiveAttendanceCounts;
  children: ReactNode;
}) {
  const [counts, setCounts] = useState(initial);

  useEffect(() => {
    setCounts(initial);
  }, [initial.active, initial.onBreak, initial.offline, initial.openShifts]);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        const data = await apiFetch.get<StatusTodayResponse>("/api/attendance/status-today", {
          timeoutMs: 15_000
        });
        if (!cancelled) {
          setCounts(countsFromPayload(data));
        }
      } catch {
        // Keep last good counts if a poll fails.
      }
    }

    const intervalId = window.setInterval(() => {
      void refresh();
    }, POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  const value = counts;

  return (
    <LiveAttendanceCountsContext.Provider value={value}>
      {children}
    </LiveAttendanceCountsContext.Provider>
  );
}

function useLiveAttendanceCounts(fallback: LiveAttendanceCounts): LiveAttendanceCounts {
  return useContext(LiveAttendanceCountsContext) ?? fallback;
}

export function DashboardLiveAttendanceSummary({
  initial
}: {
  initial: LiveAttendanceCounts;
}) {
  const counts = useLiveAttendanceCounts(initial);

  return (
    <div className="mt-2 space-y-1 text-sm">
      <div className="flex flex-wrap gap-x-3 gap-y-1 font-semibold">
        <span className="text-emerald-600 dark:text-emerald-400">{counts.active} active</span>
        <span className="text-amber-700 dark:text-amber-400">{counts.onBreak} break</span>
        <span className="text-slate-500 dark:text-slate-400">{counts.offline} offline</span>
      </div>
      <div className="text-base text-slate-500 dark:text-slate-400">
        {counts.openShifts} with an open shift (incl. break)
      </div>
    </div>
  );
}

export function DashboardLiveAttendanceCommandCards({
  initial
}: {
  initial: LiveAttendanceCounts;
}) {
  const counts = useLiveAttendanceCounts(initial);

  return (
    <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[30rem]">
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
          Active
        </p>
        <p className="mt-2 text-2xl font-semibold text-emerald-700 dark:text-emerald-300">
          {counts.active}
        </p>
      </div>
      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-800 dark:text-amber-300">
          Break
        </p>
        <p className="mt-2 text-2xl font-semibold text-amber-800 dark:text-amber-300">
          {counts.onBreak}
        </p>
      </div>
      <div className="rounded-2xl border border-slate-300/70 bg-slate-100/70 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/70">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
          Open shifts
        </p>
        <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
          {counts.openShifts}
        </p>
      </div>
    </div>
  );
}

export function DashboardLiveOpenShiftsMetric({
  initialOpenShifts
}: {
  initialOpenShifts: number;
}) {
  const counts = useLiveAttendanceCounts({
    active: 0,
    onBreak: 0,
    offline: 0,
    openShifts: initialOpenShifts
  });

  return (
    <>
      <div className="mt-3 text-3xl font-semibold text-emerald-600 dark:text-emerald-400">
        {counts.openShifts}
      </div>
      <p className="mt-2 text-base text-slate-500 dark:text-slate-400">
        Employees currently clocked in and not yet clocked out.
      </p>
    </>
  );
}
