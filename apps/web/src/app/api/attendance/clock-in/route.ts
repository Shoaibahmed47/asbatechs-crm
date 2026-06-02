import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { getLocalDateString } from "@/lib/attendance-date";

function getBearerToken(req: NextRequest): string | null {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(" ");
  if (!scheme || !token) return null;
  if (scheme.toLowerCase() !== "bearer") return null;
  return token.trim() || null;
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value ?? getBearerToken(req);
  const payload = token ? await verifyAuthToken(token) : null;

  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = payload.userId;
  const today = getLocalDateString();

  try {
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
            unscheduledIdleMinutes: 0,
            idleEventsCount: 0,
            sleepMinutes: 0,
            sleepEventsCount: 0,
            totalHours: null,
            status: "active",
            lastActivityAt: now,
            lastActivitySource: "browser"
          })
          .where(eq(schema.attendanceLogs.id, existing.id))
          .returning();
        return NextResponse.json({ attendance: updated });
      }

      const [updated] = await db
        .update(schema.attendanceLogs)
        .set({
          clockIn: now,
          status: "active",
          lastActivityAt: now,
          lastActivitySource: "browser"
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
        unscheduledIdleMinutes: 0,
        idleEventsCount: 0,
        sleepMinutes: 0,
        sleepEventsCount: 0,
        status: "active",
        lastActivityAt: now,
        lastActivitySource: "browser"
      })
      .returning();

    return NextResponse.json({ attendance: inserted }, { status: 201 });
  } catch (error) {
    console.error("[attendance/clock-in]", error);
    return NextResponse.json(
      { error: "Could not clock in. Please try again." },
      { status: 500 }
    );
  }
}
