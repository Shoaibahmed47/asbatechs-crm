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
    <div className="mt-1 space-y-0.5 text-sm">
      <div className="flex flex-wrap gap-x-2 gap-y-0.5 font-semibold">
        <span className="text-emerald-600 dark:text-emerald-400">{counts.active} active</span>
        <span className="text-amber-700 dark:text-amber-400">{counts.onBreak} break</span>
        <span className="text-slate-500 dark:text-slate-400">{counts.offline} off</span>
      </div>
      <div className="text-xs text-slate-500 dark:text-slate-400">
        {counts.openShifts} open shift{counts.openShifts === 1 ? "" : "s"}
      </div>
    </div>
  );
}

export function DashboardLiveAttendanceCommandCards({
  initial,
  /** When true, keep counts tied to the selected report date (no live today poll). */
  freezeToInitial = false
}: {
  initial: LiveAttendanceCounts;
  freezeToInitial?: boolean;
}) {
  const live = useLiveAttendanceCounts(initial);
  const counts = freezeToInitial ? initial : live;

  return (
    <div className="grid gap-2 sm:grid-cols-3 xl:min-w-[22rem]">
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-300">
          Active
        </p>
        <p className="mt-1 text-xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
          {counts.active}
        </p>
      </div>
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-amber-800 dark:text-amber-300">
          Break
        </p>
        <p className="mt-1 text-xl font-semibold tabular-nums text-amber-800 dark:text-amber-300">
          {counts.onBreak}
        </p>
      </div>
      <div className="rounded-xl border border-slate-300/70 bg-slate-100/70 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/70">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
          Open
        </p>
        <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900 dark:text-white">
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
      <div className="portal-stat-value portal-stat-value--gold tabular-nums">
        {counts.openShifts}
      </div>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 sm:text-sm">Currently clocked in</p>
    </>
  );
}
