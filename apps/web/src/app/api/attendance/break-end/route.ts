import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { resolveStaffAuth } from "@/lib/staff-auth-request";
import { getLocalDateString } from "@/lib/attendance-date";
import { notifyAdminsManualBreakEnded } from "@/lib/attendance-break-reason";
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

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

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

  const isManualBreak = openSession.breakType === "manual";
  const rawEndNote = typeof body.endNote === "string" ? body.endNote.trim() : "";

  /* FUTURE: end-break popup — return note was required here when popup was enabled
  if (isManualBreak && rawEndNote.length < 3) {
    return NextResponse.json(
      {
        error:
          "Please describe where you went / what you did before ending the break (at least 3 characters)."
      },
      { status: 400 }
    );
  }
  */

  const now = new Date();
  const diffMs = now.getTime() - new Date(openSession.breakStart as Date).getTime();
  const addedMinutes = Math.max(0, Math.floor(diffMs / 60000));

  const [sessionUpdated] = await db
    .update(schema.breakSessions)
    .set({
      breakEnd: now,
      endNote: rawEndNote ? rawEndNote.slice(0, 500) : openSession.endNote
    })
    .where(eq(schema.breakSessions.id, openSession.id))
    .returning();

  const newTotalBreak = (log.totalBreakMinutes ?? 0) + addedMinutes;

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

  if (isManualBreak) {
    const [employee] = await db
      .select({ name: schema.users.name })
      .from(schema.users)
      .where(eq(schema.users.id, userId));

    await notifyAdminsManualBreakEnded({
      employeeUserId: userId,
      employeeName: employee?.name?.trim() || "Employee",
      breakCategory: openSession.breakCategory ?? "other",
      startNote: openSession.startNote,
      endNote: rawEndNote || null,
      breakStart: new Date(openSession.breakStart as Date),
      breakEnd: now,
      durationMinutes: addedMinutes
    });
  }

  return NextResponse.json({ session: sessionUpdated, attendance: logUpdated });
}
