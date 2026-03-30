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
      { error: "No attendance log for today; clock in first." },
      { status: 400 }
    );
  }

  if (!log.clockIn) {
    return NextResponse.json(
      { error: "Clock in before starting a break." },
      { status: 400 }
    );
  }

  if (log.clockOut) {
    return NextResponse.json(
      { error: "You have already clocked out today." },
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
  if (openSession) {
    return NextResponse.json(
      { error: "There is already an open break session." },
      { status: 400 }
    );
  }

  const now = new Date();
  const [session] = await db
    .insert(schema.breakSessions)
    .values({
      attendanceLogId: log.id,
      breakStart: now
    })
    .returning();

  await db
    .update(schema.attendanceLogs)
    .set({ status: "break" })
    .where(eq(schema.attendanceLogs.id, log.id));

  return NextResponse.json({ session });
}
