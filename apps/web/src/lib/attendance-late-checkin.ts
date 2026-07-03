import { and, asc, eq, gt, isNull, lt, type SQL } from "drizzle-orm";
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
import { getExpectedCheckInTimeForEmployee } from "@/lib/attendance-employee-schedule";
import { isValidOfficeTime } from "@/lib/attendance-office-hours";
import type { PendingLateExplanation } from "@/lib/attendance-late-types";

export type { PendingLateExplanation };

function getLocalMinutesSinceMidnight(instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ATTENDANCE_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(instant);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

export function computeRawLateMinutes(clockIn: Date, expectedCheckInTime: string): number {
  if (!isValidOfficeTime(expectedCheckInTime)) return 0;
  const [expectedHour, expectedMinute] = expectedCheckInTime.split(":").map(Number);
  const expectedMinutes = expectedHour * 60 + expectedMinute;
  const actualMinutes = getLocalMinutesSinceMidnight(clockIn);
  return Math.max(0, actualMinutes - expectedMinutes);
}

/** Within grace → 0. Past grace → full raw late (e.g. 7:16 vs 7:00 with 15m grace = 16 late). */
export function applyLateGracePeriod(rawLateMinutes: number, graceMinutes: number): number {
  const grace = Math.max(0, Math.floor(graceMinutes));
  if (rawLateMinutes <= grace) return 0;
  return rawLateMinutes;
}

export function computeLateMinutes(
  clockIn: Date,
  expectedCheckInTime: string,
  graceMinutes = 0
): number {
  return applyLateGracePeriod(
    computeRawLateMinutes(clockIn, expectedCheckInTime),
    graceMinutes
  );
}

export function formatExpectedCheckInLabel(expectedCheckInTime: string): string {
  const [hour, minute] = expectedCheckInTime.split(":").map(Number);
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
}

export async function getExpectedCheckInTimeForUser(userId: number): Promise<string> {
  return getExpectedCheckInTimeForEmployee(userId);
}

export async function findPendingLateExplanation(
  userId: number
): Promise<PendingLateExplanation | null> {
  const today = getLocalDateString();

  const pendingFilters: SQL[] = [
    eq(schema.attendanceLogs.userId, userId),
    gt(schema.attendanceLogs.lateMinutes, 0),
    isNull(schema.attendanceLogs.lateReason)
  ];
  if (!ATTENDANCE_LATE_EXPLANATION_TEST_MODE) {
    pendingFilters.push(lt(schema.attendanceLogs.date, today as any));
  }

  const [row] = await db
    .select({
      id: schema.attendanceLogs.id,
      date: schema.attendanceLogs.date,
      clockIn: schema.attendanceLogs.clockIn,
      lateMinutes: schema.attendanceLogs.lateMinutes,
      expectedCheckInTime: schema.attendanceLogs.expectedCheckInTime
    })
    .from(schema.attendanceLogs)
    .where(and(...pendingFilters))
    .orderBy(asc(schema.attendanceLogs.date))
    .limit(1);

  if (!row?.clockIn || !row.date) return null;

  const date = String(row.date);
  if (
    !ATTENDANCE_LATE_EXPLANATION_TEST_MODE &&
    !(await isExplanationPromptDueForEmployee(userId, date, today))
  ) {
    return null;
  }

  const expectedCheckInTime = row.expectedCheckInTime ?? "";
  const lateMinutes = row.lateMinutes ?? 0;
  if (lateMinutes <= 0) return null;

  return {
    attendanceLogId: row.id,
    date,
    dateLabel: formatAttendanceDateLabel(date),
    lateMinutes,
    expectedCheckInTime,
    expectedCheckInLabel: expectedCheckInTime
      ? formatExpectedCheckInLabel(expectedCheckInTime)
      : "-",
    clockIn: new Date(row.clockIn as Date).toISOString(),
    clockInLabel: formatAttendanceClock(row.clockIn as Date)
  };
}

export async function submitLateExplanation(params: {
  userId: number;
  attendanceLogId: number;
  reason: string;
}): Promise<PendingLateExplanation | null> {
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
        gt(schema.attendanceLogs.lateMinutes, 0),
        isNull(schema.attendanceLogs.lateReason)
      )
    );

  if (!row) {
    throw new Error("Late explanation not found or already submitted.");
  }

  const now = new Date();
  await db
    .update(schema.attendanceLogs)
    .set({
      lateReason: reason.slice(0, 500),
      lateReasonSubmittedAt: now
    })
    .where(eq(schema.attendanceLogs.id, row.id));

  return findPendingLateExplanation(params.userId);
}

export async function hasPendingLateExplanation(userId: number): Promise<boolean> {
  const pending = await findPendingLateExplanation(userId);
  return pending != null;
}
