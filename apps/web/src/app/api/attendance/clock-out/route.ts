import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { COOKIE_NAME, verifyAuthToken } from "@/lib/auth";

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const payload = token ? await verifyAuthToken(token) : null;

  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = payload.userId;
  const today = todayDate();

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
    return NextResponse.json({ error: "No attendance log for today" }, { status: 404 });
  }

  const now = new Date();
  let totalWorkMinutes = log.totalWorkMinutes ?? 0;

  if (log.clockIn) {
    const diffMs = now.getTime() - new Date(log.clockIn as any).getTime();
    totalWorkMinutes =
      Math.floor(diffMs / 60000) - (log.totalBreakMinutes ?? 0);
    if (totalWorkMinutes < 0) totalWorkMinutes = 0;
  }

  const [updated] = await db
    .update(schema.attendanceLogs)
    .set({
      clockOut: now,
      totalWorkMinutes
    })
    .where(eq(schema.attendanceLogs.id, log.id))
    .returning();

  return NextResponse.json({ attendance: updated });
}

