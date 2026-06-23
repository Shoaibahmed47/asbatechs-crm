import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { getLocalDateString } from "@/lib/attendance-date";

export type AttendanceLogRow = typeof schema.attendanceLogs.$inferSelect;

export async function findAttendanceLogForDate(
  userId: number,
  date: string
): Promise<AttendanceLogRow | undefined> {
  const [log] = await db
    .select()
    .from(schema.attendanceLogs)
    .where(
      and(
        eq(schema.attendanceLogs.userId, userId),
        eq(schema.attendanceLogs.date, date as any)
      )
    );
  return log;
}

export async function findOpenAttendanceLog(
  userId: number
): Promise<AttendanceLogRow | undefined> {
  const [log] = await db
    .select()
    .from(schema.attendanceLogs)
    .where(
      and(
        eq(schema.attendanceLogs.userId, userId),
        isNotNull(schema.attendanceLogs.clockIn),
        isNull(schema.attendanceLogs.clockOut)
      )
    )
    .orderBy(desc(schema.attendanceLogs.date))
    .limit(1);
  return log;
}

export async function userHasOpenAttendanceShift(userId: number): Promise<boolean> {
  const log = await findOpenAttendanceLog(userId);
  return Boolean(log);
}

/**
 * Resolves the attendance log for live employee views.
 * When viewing today, an overnight open shift from the previous calendar day is included.
 */
export async function resolveAttendanceLogForLiveView(
  userId: number,
  date: string
): Promise<AttendanceLogRow | undefined> {
  const logForDate = await findAttendanceLogForDate(userId, date);
  const today = getLocalDateString();

  if (date !== today) {
    return logForDate;
  }

  if (logForDate?.clockIn && !logForDate?.clockOut) {
    return logForDate;
  }

  const openLog = await findOpenAttendanceLog(userId);
  if (openLog && String(openLog.date) !== date) {
    return openLog;
  }

  return logForDate;
}
