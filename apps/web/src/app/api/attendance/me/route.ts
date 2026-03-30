import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { getLocalDateString } from "@/lib/attendance-date";

function toDateParam(date?: string | null): string {
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  return getLocalDateString();
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const payload = token ? await verifyAuthToken(token) : null;

  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = payload.userId;
  const { searchParams } = new URL(req.url);
  const dateParam = toDateParam(searchParams.get("date"));

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
    if (openBreak) return "break";
    if (log.clockOut) return "offline";
    return "active";
  })();

  const now = Date.now();
  const completedBreakMins = log.totalBreakMinutes ?? 0;
  let liveWorkMinutes: number | null = null;
  let ongoingBreakMinutes = 0;

  if (openBreak) {
    ongoingBreakMinutes = Math.max(
      0,
      Math.floor((now - new Date(openBreak.breakStart as Date).getTime()) / 60000)
    );
  }

  if (log.clockIn && !log.clockOut) {
    const startMs = new Date(log.clockIn as Date).getTime();
    const elapsedMins = Math.max(0, Math.floor((now - startMs) / 60000));
    liveWorkMinutes = Math.max(0, elapsedMins - completedBreakMins - ongoingBreakMinutes);
  } else if (log.clockOut) {
    liveWorkMinutes = log.totalWorkMinutes ?? 0;
  }

  const totalHoursLive =
    log.clockOut && log.totalHours != null
      ? String(log.totalHours)
      : liveWorkMinutes != null
        ? (liveWorkMinutes / 60).toFixed(2)
        : null;

  return NextResponse.json({
    attendance: {
      ...log,
      status,
      liveWorkMinutes,
      totalHoursLive,
      breakSessions
    }
  });
}

