import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
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

  const [existing] = await db
    .select()
    .from(schema.attendanceLogs)
    .where(
      and(
        eq(schema.attendanceLogs.userId, userId),
        eq(schema.attendanceLogs.date, today as any)
      )
    );

  const now = new Date();

  if (existing) {
    if (existing.clockIn && !existing.clockOut) {
      return NextResponse.json(
        { error: "You are already clocked in." },
        { status: 400 }
      );
    }

    if (existing.clockOut) {
      await db
        .delete(schema.breakSessions)
        .where(eq(schema.breakSessions.attendanceLogId, existing.id));

      const [updated] = await db
        .update(schema.attendanceLogs)
        .set({
          clockIn: now,
          clockOut: null,
          totalWorkMinutes: 0,
          totalBreakMinutes: 0,
          totalHours: null,
          status: "active"
        })
        .where(eq(schema.attendanceLogs.id, existing.id))
        .returning();
      return NextResponse.json({ attendance: updated });
    }

    const [updated] = await db
      .update(schema.attendanceLogs)
      .set({
        clockIn: now,
        status: "active"
      })
      .where(eq(schema.attendanceLogs.id, existing.id))
      .returning();
    return NextResponse.json({ attendance: updated });
  }

  const [inserted] = await db
    .insert(schema.attendanceLogs)
    .values({
      userId,
      date: today as any,
      clockIn: now,
      totalWorkMinutes: 0,
      totalBreakMinutes: 0,
      status: "active"
    })
    .returning();

  return NextResponse.json({ attendance: inserted }, { status: 201 });
}
