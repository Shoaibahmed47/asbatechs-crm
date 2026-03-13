import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import type { NextRequest } from "next/server";

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const payload = token ? await verifyAuthToken(token) : null;

  if (!payload || payload.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const today = todayDate();

  const logs = await db
    .select()
    .from(schema.attendanceLogs)
    .where(eq(schema.attendanceLogs.date, today as any));

  const active: number[] = [];
  const onBreak: number[] = [];
  const offline: number[] = [];

  for (const log of logs) {
    const [openBreak] = await db
      .select()
      .from(schema.breakSessions)
      .where(
        and(
          eq(schema.breakSessions.attendanceLogId, log.id),
          isNull(schema.breakSessions.breakEnd)
        )
      );

    if (!log.clockIn || log.clockOut) {
      offline.push(log.userId);
    } else if (openBreak) {
      onBreak.push(log.userId);
    } else {
      active.push(log.userId);
    }
  }

  return NextResponse.json({ active, onBreak, offline });
}

