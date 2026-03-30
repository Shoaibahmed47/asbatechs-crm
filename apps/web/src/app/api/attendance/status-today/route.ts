import { NextResponse } from "next/server";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import type { NextRequest } from "next/server";
import { getLocalDateString } from "@/lib/attendance-date";

type LiveStatus = "active" | "break" | "offline";

function statusForLog(
  log: {
    clockIn: Date | null;
    clockOut: Date | null;
  },
  hasOpenBreak: boolean
): LiveStatus {
  if (!log.clockIn || log.clockOut) return "offline";
  if (hasOpenBreak) return "break";
  return "active";
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const payload = token ? await verifyAuthToken(token) : null;

  if (!payload || payload.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const today = getLocalDateString();

  const logs = await db
    .select()
    .from(schema.attendanceLogs)
    .where(eq(schema.attendanceLogs.date, today as any));

  const logByUserId = new Map(logs.map((l) => [l.userId, l]));
  const logIds = logs.map((l) => l.id);

  let openBreakByLogId = new Map<number, (typeof schema.breakSessions.$inferSelect) | undefined>();
  if (logIds.length > 0) {
    const openBreaks = await db
      .select()
      .from(schema.breakSessions)
      .where(
        and(
          inArray(schema.breakSessions.attendanceLogId, logIds),
          isNull(schema.breakSessions.breakEnd)
        )
      );
    openBreakByLogId = new Map(openBreaks.map((b) => [b.attendanceLogId, b]));
  }

  const allUsers = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email
    })
    .from(schema.users)
    .orderBy(asc(schema.users.name));

  const people = allUsers.map((user) => {
    const log = logByUserId.get(user.id);
    if (!log) {
      return {
        userId: user.id,
        name: user.name,
        email: user.email,
        status: "offline" as const,
        clockIn: null as string | null,
        clockOut: null as string | null
      };
    }
    const openBreak = openBreakByLogId.get(log.id);
    const status = statusForLog(
      {
        clockIn: log.clockIn,
        clockOut: log.clockOut
      },
      Boolean(openBreak)
    );
    return {
      userId: user.id,
      name: user.name,
      email: user.email,
      status,
      clockIn: log.clockIn ? new Date(log.clockIn as Date).toISOString() : null,
      clockOut: log.clockOut ? new Date(log.clockOut as Date).toISOString() : null
    };
  });

  const active = people.filter((p) => p.status === "active").map((p) => p.userId);
  const onBreak = people.filter((p) => p.status === "break").map((p) => p.userId);
  const offline = people.filter((p) => p.status === "offline").map((p) => p.userId);

  return NextResponse.json({ active, onBreak, offline, people, date: today });
}
