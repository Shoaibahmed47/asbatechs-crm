import { ATTENDANCE_TIME_ZONE } from "@/lib/attendance-date";
import { resolveExpectedShiftEndInstant } from "@/lib/attendance-early-leave";
import {
  getExpectedCheckInTimeForEmployee,
  getExpectedShiftEndTimeForEmployee
} from "@/lib/attendance-employee-schedule";
import { isValidOfficeTime } from "@/lib/attendance-office-hours";
import { buildFollowUpUtcIso } from "@/lib/follow-up-time";

export function resolveExpectedCheckInInstant(
  logDate: string,
  expectedCheckInTime: string
): Date | null {
  if (!isValidOfficeTime(expectedCheckInTime)) return null;
  const iso = buildFollowUpUtcIso({
    localDateTime: `${logDate}T${expectedCheckInTime}`,
    timeZone: ATTENDANCE_TIME_ZONE
  });
  return new Date(iso);
}

/**
 * Clip open-shift work/break calculations to the employee schedule window.
 * - Work does not count before scheduled check-in.
 * - Live totals do not grow after scheduled shift end (until clock-out is saved).
 */
export function resolveOpenShiftCalculationBounds(params: {
  logDate: string;
  clockIn: Date;
  clockOut: Date | null;
  now: Date;
  expectedCheckInTime: string;
  shiftEndTime: string;
}): { start: Date; end: Date } {
  const clockInMs = params.clockIn.getTime();
  const expectedCheckIn = resolveExpectedCheckInInstant(params.logDate, params.expectedCheckInTime);
  const expectedShiftEnd = resolveExpectedShiftEndInstant(
    params.logDate,
    params.expectedCheckInTime,
    params.shiftEndTime
  );

  const startMs = expectedCheckIn
    ? Math.max(clockInMs, expectedCheckIn.getTime())
    : clockInMs;

  let endMs: number;
  if (params.clockOut) {
    endMs = params.clockOut.getTime();
  } else {
    const nowMs = params.now.getTime();
    endMs = expectedShiftEnd ? Math.min(nowMs, expectedShiftEnd.getTime()) : nowMs;
  }

  if (endMs < startMs) {
    endMs = startMs;
  }

  return { start: new Date(startMs), end: new Date(endMs) };
}

export async function resolveOpenShiftBoundsForEmployee(params: {
  userId: number;
  logDate: string;
  clockIn: Date;
  clockOut: Date | null;
  now?: Date;
}): Promise<{ start: Date; end: Date }> {
  const now = params.now ?? new Date();
  const [expectedCheckInTime, shiftEndTime] = await Promise.all([
    getExpectedCheckInTimeForEmployee(params.userId, params.logDate),
    getExpectedShiftEndTimeForEmployee(params.userId, params.logDate)
  ]);

  return resolveOpenShiftCalculationBounds({
    logDate: params.logDate,
    clockIn: params.clockIn,
    clockOut: params.clockOut,
    now,
    expectedCheckInTime,
    shiftEndTime
  });
}
