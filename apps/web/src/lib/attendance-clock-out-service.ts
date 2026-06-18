import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { computeEarlyLeaveForClockOut } from "@/lib/attendance-early-leave";
import { UNSCHEDULED_CAUSE } from "@/lib/attendance-reason";

export type AttendanceLogClockOutRow = {
  id: number;
  userId: number;
  date: string | Date;
  clockIn: Date | string;
  clockOut?: Date | string | null;
  totalBreakMinutes?: number | null;
  unscheduledIdleMinutes?: number | null;
  sleepMinutes?: number | null;
};

/**
 * Close an open attendance shift: end open breaks, compute totals, persist clock-out.
 */
export async function finalizeAttendanceClockOut(params: {
  log: AttendanceLogClockOutRow;
  clockOutAt: Date;
  activitySource?: "browser" | "system";
}) {
  const { log, clockOutAt } = params;
  const activitySource = params.activitySource ?? "browser";

  if (!log.clockIn || log.clockOut) {
    return null;
  }

  const [openBreak] = await db
    .select()
    .from(schema.breakSessions)
    .where(
      and(
        eq(schema.breakSessions.attendanceLogId, log.id),
        isNull(schema.breakSessions.breakEnd)
      )
    );

  let totalBreakMinutes = log.totalBreakMinutes ?? 0;
  let unscheduledIdleMinutes = log.unscheduledIdleMinutes ?? 0;
  let sleepMinutes = log.sleepMinutes ?? 0;

  if (openBreak) {
    const added = Math.max(
      0,
      Math.floor(
        (clockOutAt.getTime() - new Date(openBreak.breakStart as Date).getTime()) / 60000
      )
    );
    totalBreakMinutes += added;
    if (openBreak.breakType === "unscheduled") {
      unscheduledIdleMinutes += added;
      if (openBreak.unscheduledCause === UNSCHEDULED_CAUSE.SLEEP) {
        sleepMinutes += added;
      }
    }
  }

  const clockInDate = new Date(log.clockIn as Date);
  const diffMs = clockOutAt.getTime() - clockInDate.getTime();
  let totalWorkMinutes = Math.floor(diffMs / 60000) - totalBreakMinutes;
  if (totalWorkMinutes < 0) totalWorkMinutes = 0;

  const totalHours = (totalWorkMinutes / 60).toFixed(2);

  const { earlyLeaveMinutes, expectedShiftEndTime } = await computeEarlyLeaveForClockOut({
    userId: log.userId,
    logDate: String(log.date),
    clockIn: clockInDate,
    clockOut: clockOutAt
  });

  const [updated] = await db.transaction(async (tx) => {
    if (openBreak) {
      await tx
        .update(schema.breakSessions)
        .set({ breakEnd: clockOutAt })
        .where(eq(schema.breakSessions.id, openBreak.id));
    }

    return tx
      .update(schema.attendanceLogs)
      .set({
        clockOut: clockOutAt,
        totalWorkMinutes,
        totalBreakMinutes,
        unscheduledIdleMinutes,
        sleepMinutes,
        status: "offline",
        totalHours,
        lastActivityAt: clockOutAt,
        lastActivitySource: activitySource,
        earlyLeaveMinutes,
        expectedShiftEndTime
      })
      .where(eq(schema.attendanceLogs.id, log.id))
      .returning();
  });

  return updated ?? null;
}
