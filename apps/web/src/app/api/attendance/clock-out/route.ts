import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { getLocalDateString } from "@/lib/attendance-date";
import { UNSCHEDULED_CAUSE } from "@/lib/attendance-reason";

export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const payload = token ? await verifyAuthToken(token) : null;

  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
        (now.getTime() - new Date(openBreak.breakStart as Date).getTime()) /
          60000
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

  const diffMs = now.getTime() - new Date(log.clockIn as Date).getTime();
  let totalWorkMinutes = Math.floor(diffMs / 60000) - totalBreakMinutes;
  if (totalWorkMinutes < 0) totalWorkMinutes = 0;

  const totalHours = (totalWorkMinutes / 60).toFixed(2);

  const [updated] = await db.transaction(async (tx) => {
    if (openBreak) {
      await tx
        .update(schema.breakSessions)
        .set({ breakEnd: now })
        .where(eq(schema.breakSessions.id, openBreak.id));
    }

    return tx
      .update(schema.attendanceLogs)
      .set({
        clockOut: now,
        totalWorkMinutes,
        totalBreakMinutes,
        unscheduledIdleMinutes,
        sleepMinutes,
        status: "offline",
        totalHours,
        lastActivityAt: now,
        lastActivitySource: "browser"
      })
      .where(eq(schema.attendanceLogs.id, log.id))
      .returning();
  });

  return NextResponse.json({ attendance: updated });
}
