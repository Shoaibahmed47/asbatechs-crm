import { and, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { getLocalDateString } from "@/lib/attendance-date";
import { addAttendanceCalendarDays } from "@/lib/attendance-working-days";

export type OpenAttendanceLogRow = typeof schema.attendanceLogs.$inferSelect;

/**
 * Finds the user's open attendance log for live actions (clock-out, breaks, activity).
 * After midnight, an overnight shift keyed to yesterday's calendar date stays open
 * until manual clock-out.
 */
export async function resolveOpenAttendanceLogForUser(params: {
  userId: number;
  now?: Date;
}): Promise<{ log: OpenAttendanceLogRow; logDate: string } | null> {
  const now = params.now ?? new Date();
  const today = getLocalDateString(now);
  const yesterday = addAttendanceCalendarDays(today, -1);

  const rows = await db
    .select()
    .from(schema.attendanceLogs)
    .where(
      and(
        eq(schema.attendanceLogs.userId, params.userId),
        inArray(schema.attendanceLogs.date, [today, yesterday] as any),
        isNotNull(schema.attendanceLogs.clockIn),
        isNull(schema.attendanceLogs.clockOut)
      )
    )
    .orderBy(desc(schema.attendanceLogs.date));

  if (rows.length === 0) return null;

  const todayLog = rows.find((row) => String(row.date) === today);
  if (todayLog) {
    return { log: todayLog, logDate: today };
  }

  const yesterdayLog = rows.find((row) => String(row.date) === yesterday);
  if (yesterdayLog) {
    return { log: yesterdayLog, logDate: yesterday };
  }

  return null;
}
