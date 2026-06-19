import { getAwayThresholdMs, type ComplianceAwayCause } from "@/lib/attendance-away-compliance";
import { UNSCHEDULED_CAUSE, type UnscheduledCause } from "@/lib/attendance-reason";

export type ShiftBreakSession = {
  breakStart: Date | string;
  breakEnd: Date | string | null;
  breakType: string;
  unscheduledCause?: string | null;
};

function toMs(value: Date | string): number {
  return new Date(value).getTime();
}

function minutesBetween(startMs: number, endMs: number): number {
  return Math.max(0, Math.floor((endMs - startMs) / 60000));
}

function isComplianceCause(
  value: string | null | undefined
): value is ComplianceAwayCause {
  return (
    value === UNSCHEDULED_CAUSE.TAB_CLOSE ||
    value === UNSCHEDULED_CAUSE.CURSOR_IDLE ||
    value === UNSCHEDULED_CAUSE.SLEEP
  );
}

/** Unscheduled away only counts as break time once it meets the policy threshold. */
function countsTowardBreakMinutes(
  session: ShiftBreakSession,
  durationMs: number
): boolean {
  if (session.breakType === "manual") return true;
  if (session.breakType !== "unscheduled") return false;
  if (!isComplianceCause(session.unscheduledCause)) return durationMs >= 60_000;
  return durationMs >= getAwayThresholdMs(session.unscheduledCause);
}

function mergeBreakIntervals(
  intervals: Array<{ start: number; end: number }>
): number {
  if (intervals.length === 0) return 0;
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  let mergedMs = 0;
  let curStart = sorted[0].start;
  let curEnd = sorted[0].end;

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    if (next.start <= curEnd) {
      curEnd = Math.max(curEnd, next.end);
      continue;
    }
    mergedMs += curEnd - curStart;
    curStart = next.start;
    curEnd = next.end;
  }
  mergedMs += curEnd - curStart;
  return Math.floor(mergedMs / 60000);
}

/**
 * Live work/break minutes from clock-in and break sessions (merged intervals).
 * Avoids inflated break totals from stacked counters or sub-threshold away blips.
 */
export function computeLiveShiftMinutes(params: {
  clockIn: Date | string;
  clockOut: Date | string | null;
  now: Date;
  breakSessions: ShiftBreakSession[];
  /** Optional clip window for display / open-shift totals. */
  calculationStart?: Date | string;
  calculationEnd?: Date | string;
}): { workMinutes: number; breakMinutes: number; elapsedMinutes: number } {
  const clockInMs = toMs(params.calculationStart ?? params.clockIn);
  const shiftEndMs = params.clockOut
    ? toMs(params.clockOut)
    : toMs(params.calculationEnd ?? params.now);
  const elapsedMinutes = minutesBetween(clockInMs, shiftEndMs);

  const intervals: Array<{ start: number; end: number }> = [];

  for (const session of params.breakSessions) {
    const startMs = Math.max(clockInMs, toMs(session.breakStart));
    const endMs = Math.min(
      shiftEndMs,
      session.breakEnd ? toMs(session.breakEnd) : shiftEndMs
    );
    if (endMs <= startMs) continue;

    const durationMs = endMs - startMs;
    if (!countsTowardBreakMinutes(session, durationMs)) continue;

    intervals.push({ start: startMs, end: endMs });
  }

  const breakMinutes = mergeBreakIntervals(intervals);
  const workMinutes = Math.max(0, elapsedMinutes - breakMinutes);

  return { workMinutes, breakMinutes, elapsedMinutes };
}

export type DayTotalsFromSessions = {
  workMinutes: number;
  breakMinutes: number;
  inactiveMinutes: number;
  sleepMinutes: number;
  inactiveEventsCount: number;
  sleepEventsCount: number;
  elapsedMinutes: number;
};

function sessionDurationMs(
  session: ShiftBreakSession,
  clockInMs: number,
  shiftEndMs: number
): number {
  const startMs = Math.max(clockInMs, toMs(session.breakStart));
  const endMs = Math.min(
    shiftEndMs,
    session.breakEnd ? toMs(session.breakEnd) : shiftEndMs
  );
  return Math.max(0, endMs - startMs);
}

function isInactiveCause(cause: string | null | undefined): boolean {
  return (
    cause === UNSCHEDULED_CAUSE.TAB_CLOSE ||
    cause === UNSCHEDULED_CAUSE.CURSOR_IDLE ||
    cause === UNSCHEDULED_CAUSE.IDLE
  );
}

/**
 * Day totals for admin detail / reports — derived from break sessions, not stale counters.
 */
export function computeDayTotalsFromSessions(params: {
  clockIn: Date | string;
  clockOut: Date | string | null;
  now: Date;
  breakSessions: ShiftBreakSession[];
  calculationStart?: Date | string;
  calculationEnd?: Date | string;
}): DayTotalsFromSessions {
  const live = computeLiveShiftMinutes(params);
  const clockInMs = toMs(params.calculationStart ?? params.clockIn);
  const shiftEndMs = params.clockOut
    ? toMs(params.clockOut)
    : toMs(params.calculationEnd ?? params.now);

  const breakIntervals: Array<{ start: number; end: number }> = [];
  const inactiveIntervals: Array<{ start: number; end: number }> = [];
  const sleepIntervals: Array<{ start: number; end: number }> = [];

  let inactiveEventsCount = 0;
  let sleepEventsCount = 0;

  for (const session of params.breakSessions) {
    const durationMs = sessionDurationMs(session, clockInMs, shiftEndMs);
    if (durationMs <= 0) continue;

    const startMs = Math.max(clockInMs, toMs(session.breakStart));
    const endMs = startMs + durationMs;
    const counts = countsTowardBreakMinutes(session, durationMs);

    if (session.breakType === "unscheduled") {
      if (session.unscheduledCause === UNSCHEDULED_CAUSE.SLEEP && counts) {
        sleepIntervals.push({ start: startMs, end: endMs });
        sleepEventsCount += 1;
      } else if (isInactiveCause(session.unscheduledCause) && counts) {
        inactiveIntervals.push({ start: startMs, end: endMs });
        inactiveEventsCount += 1;
      }
    }

    if (counts) {
      breakIntervals.push({ start: startMs, end: endMs });
    }
  }

  return {
    workMinutes: live.workMinutes,
    breakMinutes: mergeBreakIntervals(breakIntervals),
    inactiveMinutes: mergeBreakIntervals(inactiveIntervals),
    sleepMinutes: mergeBreakIntervals(sleepIntervals),
    inactiveEventsCount,
    sleepEventsCount,
    elapsedMinutes: live.elapsedMinutes
  };
}
