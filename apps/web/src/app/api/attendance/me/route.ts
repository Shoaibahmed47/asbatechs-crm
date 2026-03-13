import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { COOKIE_NAME, verifyAuthToken } from "@/lib/auth";

function toDateParam(date?: string | null): string {
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  return new Date().toISOString().slice(0, 10);
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

  const status = (() => {
    if (!log.clockIn) return "offline";
    if (openBreak) return "on_break";
    if (log.clockOut) return "offline";
    return "active";
  })();

  return NextResponse.json({
    attendance: {
      ...log,
      status
    }
  });
}

