import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { schema } from "@asbatechs-crm/database";
import { db } from "@/lib/db";
import {
  finalizeAttendanceClockOut,
  type AttendanceLogClockOutRow
} from "@/lib/attendance-clock-out-service";
import { resolveExpectedShiftEndInstant } from "@/lib/attendance-early-leave";
import {
  promoteAllDueEmployeeSchedules,
  resolveEmployeeScheduleForDate,
  type UserScheduleFields
} from "@/lib/attendance-employee-schedule";
import { getAttendanceOfficeHours } from "@/lib/attendance-office-settings";

/**
 * When shift end has passed, returns the instant to use for automatic clock-out.
 * Uses scheduled shift end (not current time) so work hours stay accurate.
 */
export function resolveAutoClockOutInstant(params: {
  logDate: string;
  clockIn: Date;
  expectedCheckInTime: string;
  shiftEndTime: string;
  now: Date;
}): Date | null {
  const expectedEnd = resolveExpectedShiftEndInstant(
    params.logDate,
    params.expectedCheckInTime,
    params.shiftEndTime
  );
  if (!expectedEnd || params.now.getTime() < expectedEnd.getTime()) {
    return null;
  }

  const clockInMs = params.clockIn.getTime();
  if (expectedEnd.getTime() < clockInMs) {
    return new Date(clockInMs);
  }

  return expectedEnd;
}

type OpenShiftRow = {
  log: AttendanceLogClockOutRow;
  userSchedule: UserScheduleFields;
};

async function loadOpenShifts(userId?: number): Promise<OpenShiftRow[]> {
  const filters = [isNotNull(schema.attendanceLogs.clockIn), isNull(schema.attendanceLogs.clockOut)];
  if (userId != null) {
    filters.push(eq(schema.attendanceLogs.userId, userId));
  }

  const rows = await db
    .select({
      id: schema.attendanceLogs.id,
      userId: schema.attendanceLogs.userId,
      date: schema.attendanceLogs.date,
      clockIn: schema.attendanceLogs.clockIn,
      clockOut: schema.attendanceLogs.clockOut,
      totalBreakMinutes: schema.attendanceLogs.totalBreakMinutes,
      unscheduledIdleMinutes: schema.attendanceLogs.unscheduledIdleMinutes,
      sleepMinutes: schema.attendanceLogs.sleepMinutes,
      expectedCheckInTime: schema.users.expectedCheckInTime,
      expectedShiftEndTime: schema.users.expectedShiftEndTime,
      pendingExpectedCheckInTime: schema.users.pendingExpectedCheckInTime,
      pendingExpectedShiftEndTime: schema.users.pendingExpectedShiftEndTime,
      scheduleEffectiveFrom: schema.users.scheduleEffectiveFrom
    })
    .from(schema.attendanceLogs)
    .innerJoin(schema.users, eq(schema.attendanceLogs.userId, schema.users.id))
    .where(and(...filters));

  return rows
    .filter((row) => row.clockIn != null)
    .map((row) => ({
      log: {
        id: row.id,
        userId: row.userId,
        date: row.date as string | Date,
        clockIn: row.clockIn as Date,
        clockOut: row.clockOut,
        totalBreakMinutes: row.totalBreakMinutes,
        unscheduledIdleMinutes: row.unscheduledIdleMinutes,
        sleepMinutes: row.sleepMinutes
      },
      userSchedule: {
        expectedCheckInTime: row.expectedCheckInTime,
        expectedShiftEndTime: row.expectedShiftEndTime,
        pendingExpectedCheckInTime: row.pendingExpectedCheckInTime,
        pendingExpectedShiftEndTime: row.pendingExpectedShiftEndTime,
        scheduleEffectiveFrom: row.scheduleEffectiveFrom
      }
    }));
}

/**
 * Auto clock-out open shifts whose scheduled shift end has passed.
 * Uses each employee's schedule for the attendance log date.
 */
export async function autoClockOutDueOpenShifts(params?: {
  userId?: number;
  now?: Date;
}): Promise<{ closedCount: number; closedLogIds: number[] }> {
  const now = params?.now ?? new Date();
  await promoteAllDueEmployeeSchedules();
  const office = await getAttendanceOfficeHours();
  const openShifts = await loadOpenShifts(params?.userId);

  const closedLogIds: number[] = [];

  for (const row of openShifts) {
    const logDate = String(row.log.date);
    const resolved = resolveEmployeeScheduleForDate(row.userSchedule, office, logDate);

    const clockOutAt = resolveAutoClockOutInstant({
      logDate,
      clockIn: new Date(row.log.clockIn),
      expectedCheckInTime: resolved.effectiveExpectedCheckInTime,
      shiftEndTime: resolved.effectiveExpectedShiftEndTime,
      now
    });

    if (!clockOutAt) continue;

    const updated = await finalizeAttendanceClockOut({
      log: row.log,
      clockOutAt,
      activitySource: "system"
    });

    if (updated) {
      closedLogIds.push(updated.id);
    }
  }

  return { closedCount: closedLogIds.length, closedLogIds };
}
