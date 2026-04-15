import { asc, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";

export type LiveAttendanceStatus = "active" | "break" | "offline";

export type PersonAttendanceStatus = {
  userId: number;
  name: string;
  email: string;
  status: LiveAttendanceStatus;
  clockIn: string | null;
  clockOut: string | null;
  /** Current open break start, or last completed break start today (ISO). */
  breakStart: string | null;
  /** Null while break is open; last completed break end when not on break. */
  breakEnd: string | null;
  /** Whether `breakStart`/`breakEnd` describe an in-progress break. */
  breakIsOpen: boolean;
};

function statusForLog(
  log: { clockIn: Date | null; clockOut: Date | null },
  hasOpenBreak: boolean
): LiveAttendanceStatus {
  if (!log.clockIn || log.clockOut) return "offline";
  if (hasOpenBreak) return "break";
  return "active";
}

function toIso(d: Date | null): string | null {
  if (!d) return null;
  return new Date(d as Date).toISOString();
}

type BreakRow = typeof schema.breakSessions.$inferSelect;

function resolveBreakTimesForLiveView(sessions: BreakRow[]): {
  breakStart: string | null;
  breakEnd: string | null;
  breakIsOpen: boolean;
} {
  if (sessions.length === 0) {
    return { breakStart: null, breakEnd: null, breakIsOpen: false };
  }
  const sorted = [...sessions].sort(
    (a, b) =>
      new Date(a.breakStart as Date).getTime() - new Date(b.breakStart as Date).getTime()
  );
  const open = sorted.find((s) => !s.breakEnd);
  if (open) {
    return {
      breakStart: toIso(open.breakStart as Date | null),
      breakEnd: null,
      breakIsOpen: true
    };
  }
  const completed = sorted.filter((s) => s.breakEnd);
  if (completed.length === 0) {
    return { breakStart: null, breakEnd: null, breakIsOpen: false };
  }
  const last = completed.reduce((a, b) =>
    new Date(a.breakEnd as Date).getTime() > new Date(b.breakEnd as Date).getTime() ? a : b
  );
  return {
    breakStart: toIso(last.breakStart as Date | null),
    breakEnd: toIso(last.breakEnd as Date | null),
    breakIsOpen: false
  };
}

/** Today’s live attendance status for every user (for admin dashboards and APIs). */
export async function getAttendanceStatusForDate(date: string): Promise<{
  people: PersonAttendanceStatus[];
  date: string;
}> {
  const logs = await db
    .select()
    .from(schema.attendanceLogs)
    .where(eq(schema.attendanceLogs.date, date as any));

  const logByUserId = new Map(logs.map((l) => [l.userId, l]));
  const logIds = logs.map((l) => l.id);

  const openBreakByLogId = new Map<number, BreakRow | undefined>();
  const breaksByLogId = new Map<number, BreakRow[]>();
  if (logIds.length > 0) {
    const allBreaks = await db
      .select()
      .from(schema.breakSessions)
      .where(inArray(schema.breakSessions.attendanceLogId, logIds));
    for (const b of allBreaks) {
      const arr = breaksByLogId.get(b.attendanceLogId) ?? [];
      arr.push(b);
      breaksByLogId.set(b.attendanceLogId, arr);
      if (!b.breakEnd) {
        openBreakByLogId.set(b.attendanceLogId, b);
      }
    }
  }

  const allUsers = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email
    })
    .from(schema.users)
    .orderBy(asc(schema.users.name));

  const people: PersonAttendanceStatus[] = allUsers.map((user) => {
    const log = logByUserId.get(user.id);
    if (!log) {
      return {
        userId: user.id,
        name: user.name,
        email: user.email,
        status: "offline" as const,
        clockIn: null,
        clockOut: null,
        breakStart: null,
        breakEnd: null,
        breakIsOpen: false
      };
    }
    const openBreak = openBreakByLogId.get(log.id);
    const status = statusForLog(
      { clockIn: log.clockIn, clockOut: log.clockOut },
      Boolean(openBreak)
    );
    const sessionRows = breaksByLogId.get(log.id) ?? [];
    const { breakStart, breakEnd, breakIsOpen } = resolveBreakTimesForLiveView(sessionRows);
    return {
      userId: user.id,
      name: user.name,
      email: user.email,
      status,
      clockIn: log.clockIn ? new Date(log.clockIn as Date).toISOString() : null,
      clockOut: log.clockOut ? new Date(log.clockOut as Date).toISOString() : null,
      breakStart,
      breakEnd,
      breakIsOpen
    };
  });

  return { people, date };
}

export function countAttendanceByStatus(people: PersonAttendanceStatus[]) {
  let active = 0;
  let onBreak = 0;
  let offline = 0;
  for (const p of people) {
    if (p.status === "active") active += 1;
    else if (p.status === "break") onBreak += 1;
    else offline += 1;
  }
  return { active, onBreak, offline, openShift: active + onBreak };
}
