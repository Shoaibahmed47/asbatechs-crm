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
    const [updated] = await db
      .update(schema.attendanceLogs)
      .set({ clockIn: now })
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
      totalBreakMinutes: 0
    })
    .returning();

  return NextResponse.json({ attendance: inserted }, { status: 201 });
}

