import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { resolveStaffAuth } from "@/lib/staff-auth-request";
import { getLocalDateString } from "@/lib/attendance-date";
import { ATTENDANCE_EXTRA_BREAK_ENABLED } from "@/lib/attendance-policy";
import { normalizeBreakCategory } from "@/lib/attendance-break-shared";
import { rejectAttendanceOnWeekend } from "@/lib/attendance-weekend-guard";

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

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const category = normalizeBreakCategory(body.category);
  if (!category) {
    return NextResponse.json(
      { error: "Please select a break type (lunch, prayer, etc.)." },
      { status: 400 }
    );
  }

  const rawNote = typeof body.note === "string" ? body.note.trim() : "";
  if (rawNote.length < 3) {
    return NextResponse.json(
      {
        error:
          "Please say where you are going before starting break (at least 3 characters)."
      },
      { status: 400 }
    );
  }

  const manualSessionsToday = await db
    .select({ id: schema.breakSessions.id })
    .from(schema.breakSessions)
    .where(
      and(
        eq(schema.breakSessions.attendanceLogId, log.id),
        eq(schema.breakSessions.breakType, "manual")
      )
    );
  const hasUsedOfficialBreak = manualSessionsToday.length >= 1;

  if (hasUsedOfficialBreak && !ATTENDANCE_EXTRA_BREAK_ENABLED) {
    return NextResponse.json(
      { error: "You already used your break for today. Contact your manager if you need another." },
      { status: 400 }
    );
  }

  const now = new Date();
  const [session] = await db
    .insert(schema.breakSessions)
    .values({
      attendanceLogId: log.id,
      breakStart: now,
      breakType: "manual",
      breakCategory: category,
      startNote: rawNote ? rawNote.slice(0, 240) : null
    })
    .returning();

  await db
    .update(schema.attendanceLogs)
    .set({ status: "break", lastActivityAt: now, lastActivitySource: "browser" })
    .where(eq(schema.attendanceLogs.id, log.id));

  return NextResponse.json({ session });
}
