import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { getLocalDateString } from "@/lib/attendance-date";

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
      { error: "No attendance log for today." },
      { status: 400 }
    );
  }

  if (log.clockOut) {
    return NextResponse.json(
      { error: "Shift already ended. Break was closed when you clocked out." },
      { status: 400 }
    );
  }

  const [openSession] = await db
    .select()
    .from(schema.breakSessions)
    .where(
      and(
        eq(schema.breakSessions.attendanceLogId, log.id),
        isNull(schema.breakSessions.breakEnd)
      )
    );

  if (!openSession) {
    return NextResponse.json(
      { error: "No open break session." },
      { status: 400 }
    );
  }

  const now = new Date();
  const diffMs = now.getTime() - new Date(openSession.breakStart as Date).getTime();
  const addedMinutes = Math.floor(diffMs / 60000);

  const [sessionUpdated] = await db
    .update(schema.breakSessions)
    .set({ breakEnd: now })
    .where(eq(schema.breakSessions.id, openSession.id))
    .returning();

  const newTotalBreak =
    (log.totalBreakMinutes ?? 0) + (addedMinutes > 0 ? addedMinutes : 0);

  const [logUpdated] = await db
    .update(schema.attendanceLogs)
    .set({
      totalBreakMinutes: newTotalBreak,
      status: "active",
      lastActivityAt: now,
      lastActivitySource: "browser"
    })
    .where(eq(schema.attendanceLogs.id, log.id))
    .returning();

  return NextResponse.json({ session: sessionUpdated, attendance: logUpdated });
}
