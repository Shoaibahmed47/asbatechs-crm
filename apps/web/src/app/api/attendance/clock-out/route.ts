import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { resolveStaffAuth } from "@/lib/staff-auth-request";
import { getLocalDateString } from "@/lib/attendance-date";
import { finalizeAttendanceClockOut } from "@/lib/attendance-clock-out-service";
import { rejectAttendanceOnWeekend } from "@/lib/attendance-weekend-guard";
import { buildClockOutFeedbackMessage } from "@/lib/attendance-clock-feedback";

export async function POST(req: NextRequest) {
  const payload = await resolveStaffAuth(req);

  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const weekendBlocked = rejectAttendanceOnWeekend();
  if (weekendBlocked) return weekendBlocked;

  const userId = payload.userId;
  const today = getLocalDateString();

  const [log] = await db
    .select()
    .from(schema.attendanceLogs)
    .where(
      and(
        eq(schema.attendanceLogs.userId, userId),
        eq(schema.attendanceLogs.date, today as any)
      )
    );

  if (!log) {
    return NextResponse.json(
      { error: "No attendance log for today. Clock in first." },
      { status: 404 }
    );
  }

  if (!log.clockIn) {
    return NextResponse.json(
      { error: "Clock in before clocking out." },
      { status: 400 }
    );
  }

  if (log.clockOut) {
    return NextResponse.json(
      { error: "You are already clocked out." },
      { status: 400 }
    );
  }

  const now = new Date();
  const updated = await finalizeAttendanceClockOut({
    log: {
      id: log.id,
      userId,
      date: log.date,
      clockIn: log.clockIn as Date,
      clockOut: log.clockOut,
      totalBreakMinutes: log.totalBreakMinutes,
      unscheduledIdleMinutes: log.unscheduledIdleMinutes,
      sleepMinutes: log.sleepMinutes
    },
    clockOutAt: now,
    activitySource: "browser"
  });

  if (!updated) {
    return NextResponse.json({ error: "Could not clock out." }, { status: 500 });
  }

  return NextResponse.json({
    attendance: updated,
    feedback: {
      workMinutes: updated.totalWorkMinutes ?? 0,
      message: buildClockOutFeedbackMessage(updated.totalWorkMinutes ?? 0)
    }
  });
}
