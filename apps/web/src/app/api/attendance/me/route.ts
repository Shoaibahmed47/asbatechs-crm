import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { resolveStaffAuth } from "@/lib/staff-auth-request";
import { autoClockOutDueOpenShifts } from "@/lib/attendance-auto-clock-out";
import { getLocalDateString } from "@/lib/attendance-date";
import { resolveOpenShiftBoundsForEmployee } from "@/lib/attendance-shift-window";
import { computeLiveShiftMinutes } from "@/lib/attendance-shift-minutes";
import { UNSCHEDULED_CAUSE } from "@/lib/attendance-reason";

function toDateParam(date?: string | null): string {
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  return getLocalDateString();
}

export async function GET(req: NextRequest) {
  const payload = await resolveStaffAuth(req);

  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = payload.userId;
  const { searchParams } = new URL(req.url);
  const dateParam = toDateParam(searchParams.get("date"));

  await autoClockOutDueOpenShifts({ userId });

  const [log] = await db
    .select()
    .from(schema.attendanceLogs)
    .where(
      and(
        eq(schema.attendanceLogs.userId, userId),
        eq(schema.attendanceLogs.date, dateParam as any)
      )
    );

  if (!log) {
    return NextResponse.json({ attendance: null });
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

  const breakSessions = await db
    .select()
    .from(schema.breakSessions)
    .where(eq(schema.breakSessions.attendanceLogId, log.id))
    .orderBy(asc(schema.breakSessions.breakStart));

  const status = (() => {
    if (!log.clockIn) return "offline";
    if (openBreak?.breakType === "unscheduled") return "idle";
    if (openBreak) return "break";
    if (log.clockOut) return "offline";
    if (log.status === "idle") return "idle";
    return "active";
  })();

  const now = new Date();
  let liveWorkMinutes: number | null = null;
  let liveBreakMinutes: number | null = null;
  let ongoingSleepMinutes = 0;

  if (openBreak) {
    const ongoingBreakMinutes = Math.max(
      0,
      Math.floor(
        (now.getTime() - new Date(openBreak.breakStart as Date).getTime()) / 60000
      )
    );
    if (
      openBreak.breakType === "unscheduled" &&
      openBreak.unscheduledCause === UNSCHEDULED_CAUSE.SLEEP
    ) {
      ongoingSleepMinutes = ongoingBreakMinutes;
    }
  }

  if (log.clockIn && !log.clockOut) {
    const bounds = await resolveOpenShiftBoundsForEmployee({
      userId,
      logDate: dateParam,
      clockIn: new Date(log.clockIn as Date),
      clockOut: null,
      now
    });
    const live = computeLiveShiftMinutes({
      clockIn: log.clockIn as Date,
      clockOut: null,
      now,
      calculationStart: bounds.start,
      calculationEnd: bounds.end,
      breakSessions: breakSessions.map((session) => ({
        breakStart: session.breakStart as Date,
        breakEnd: session.breakEnd as Date | null,
        breakType: session.breakType,
        unscheduledCause: session.unscheduledCause
      }))
    });
    liveWorkMinutes = live.workMinutes;
    liveBreakMinutes = live.breakMinutes;
  } else if (log.clockOut) {
    liveWorkMinutes = log.totalWorkMinutes ?? 0;
    liveBreakMinutes = log.totalBreakMinutes ?? 0;
  }

  const totalHoursLive =
    log.clockOut && log.totalHours != null
      ? String(log.totalHours)
      : liveWorkMinutes != null
        ? (liveWorkMinutes / 60).toFixed(2)
        : null;
  const totalSleepMinutesLive = (log.sleepMinutes ?? 0) + ongoingSleepMinutes;

  return NextResponse.json({
    attendance: {
      ...log,
      status,
      liveWorkMinutes,
      liveBreakMinutes,
      totalSleepMinutesLive,
      totalHoursLive,
      breakSessions
    }
  });
}
