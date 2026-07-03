import { and, asc, eq, gt, isNotNull, isNull, lt, type SQL } from "drizzle-orm";
import { schema } from "@asbatechs-crm/database";
import { db } from "@/lib/db";
import {
  ATTENDANCE_TIME_ZONE,
  formatAttendanceClock,
  formatAttendanceDateLabel,
  getLocalDateString
} from "@/lib/attendance-date";
import { ATTENDANCE_LATE_EXPLANATION_TEST_MODE } from "@/lib/attendance-policy";
import { isExplanationPromptDueForEmployee } from "@/lib/attendance-employee-working-day";
import type { PendingEarlyLeaveExplanation } from "@/lib/attendance-early-leave-types";

export type { PendingEarlyLeaveExplanation };
import { getExpectedCheckInTimeForEmployee, getExpectedShiftEndTimeForEmployee } from "@/lib/attendance-employee-schedule";
import {
  isValidOfficeTime,
  officeShiftEndsNextDay,
  formatOfficeTimeLabel
} from "@/lib/attendance-office-hours";
import { buildFollowUpUtcIso } from "@/lib/follow-up-time";

function addCalendarDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const cursor = new Date(Date.UTC(y, m - 1, d));
  cursor.setUTCDate(cursor.getUTCDate() + days);
  const yy = cursor.getUTCFullYear();
  const mm = String(cursor.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(cursor.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function resolveExpectedShiftEndInstant(
  logDate: string,
  expectedCheckInTime: string,
  shiftEndTime: string
): Date | null {
  if (!isValidOfficeTime(expectedCheckInTime) || !isValidOfficeTime(shiftEndTime)) {
    return null;
  }
  const endDate = officeShiftEndsNextDay(expectedCheckInTime, shiftEndTime)
    ? addCalendarDays(logDate, 1)
    : logDate;
  const iso = buildFollowUpUtcIso({
    localDateTime: `${endDate}T${shiftEndTime}`,
    timeZone: ATTENDANCE_TIME_ZONE
  });
  return new Date(iso);
}

export function computeEarlyLeaveMinutes(clockOut: Date, expectedShiftEnd: Date): number {
  const diffMs = expectedShiftEnd.getTime() - clockOut.getTime();
  if (diffMs <= 0) return 0;
  return Math.floor(diffMs / 60000);
}

export function formatShiftEndLabel(shiftEndTime: string): string {
  return formatOfficeTimeLabel(shiftEndTime);
}

export async function computeEarlyLeaveForClockOut(params: {
  userId: number;
  logDate: string;
  clockIn: Date;
  clockOut: Date;
}): Promise<{ earlyLeaveMinutes: number; expectedShiftEndTime: string }> {
  const expectedCheckInTime = await getExpectedCheckInTimeForEmployee(
    params.userId,
    params.logDate
  );
  const shiftEndTime = await getExpectedShiftEndTimeForEmployee(params.userId, params.logDate);
  const expectedEnd = resolveExpectedShiftEndInstant(
    params.logDate,
    expectedCheckInTime,
    shiftEndTime
  );
  const earlyLeaveMinutes = expectedEnd
    ? computeEarlyLeaveMinutes(params.clockOut, expectedEnd)
    : 0;
  return { earlyLeaveMinutes, expectedShiftEndTime: shiftEndTime };
}

export async function findPendingEarlyLeaveExplanation(
  userId: number
): Promise<PendingEarlyLeaveExplanation | null> {
  const today = getLocalDateString();

  const pendingFilters: SQL[] = [
    eq(schema.attendanceLogs.userId, userId),
    gt(schema.attendanceLogs.earlyLeaveMinutes, 0),
    isNull(schema.attendanceLogs.earlyLeaveReason),
    isNotNull(schema.attendanceLogs.clockOut)
  ];
  if (!ATTENDANCE_LATE_EXPLANATION_TEST_MODE) {
    pendingFilters.push(lt(schema.attendanceLogs.date, today as any));
  }

  const [row] = await db
    .select({
      id: schema.attendanceLogs.id,
      date: schema.attendanceLogs.date,
      clockOut: schema.attendanceLogs.clockOut,
      earlyLeaveMinutes: schema.attendanceLogs.earlyLeaveMinutes,
      expectedShiftEndTime: schema.attendanceLogs.expectedShiftEndTime
    })
    .from(schema.attendanceLogs)
    .where(and(...pendingFilters))
    .orderBy(asc(schema.attendanceLogs.date))
    .limit(1);

  if (!row?.clockOut || !row.date) return null;

  const date = String(row.date);
  if (
    !ATTENDANCE_LATE_EXPLANATION_TEST_MODE &&
    !(await isExplanationPromptDueForEmployee(userId, date, today))
  ) {
    return null;
  }

  const earlyLeaveMinutes = row.earlyLeaveMinutes ?? 0;
  if (earlyLeaveMinutes <= 0) return null;

  const expectedShiftEndTime = row.expectedShiftEndTime ?? "";
  return {
    attendanceLogId: row.id,
    date,
    dateLabel: formatAttendanceDateLabel(date),
    earlyLeaveMinutes,
    expectedShiftEndTime,
    expectedShiftEndLabel: expectedShiftEndTime
      ? formatShiftEndLabel(expectedShiftEndTime)
      : "-",
    clockOut: new Date(row.clockOut as Date).toISOString(),
    clockOutLabel: formatAttendanceClock(row.clockOut as Date)
  };
}

export async function submitEarlyLeaveExplanation(params: {
  userId: number;
  attendanceLogId: number;
  reason: string;
}): Promise<PendingEarlyLeaveExplanation | null> {
  const reason = params.reason.trim();
  if (reason.length < 3) {
    throw new Error("Please enter a reason (at least 3 characters).");
  }

  const [row] = await db
    .select()
    .from(schema.attendanceLogs)
    .where(
      and(
        eq(schema.attendanceLogs.id, params.attendanceLogId),
        eq(schema.attendanceLogs.userId, params.userId),
        gt(schema.attendanceLogs.earlyLeaveMinutes, 0),
        isNull(schema.attendanceLogs.earlyLeaveReason),
        isNotNull(schema.attendanceLogs.clockOut)
      )
    );

  if (!row) {
    throw new Error("Early leave explanation not found or already submitted.");
  }

  const now = new Date();
  await db
    .update(schema.attendanceLogs)
    .set({
      earlyLeaveReason: reason.slice(0, 500),
      earlyLeaveReasonSubmittedAt: now
    })
    .where(eq(schema.attendanceLogs.id, row.id));

  return findPendingEarlyLeaveExplanation(params.userId);
}

export async function hasPendingEarlyLeaveExplanation(userId: number): Promise<boolean> {
  const pending = await findPendingEarlyLeaveExplanation(userId);
  return pending != null;
}

