import { asc, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { UNSCHEDULED_CAUSE } from "@/lib/attendance-reason";

export type LiveAttendanceStatus = "active" | "break" | "idle" | "offline";

export type PersonAttendanceStatus = {
  userId: number;
  name: string;
  email: string;
  status: LiveAttendanceStatus;
  /** Human-readable reason for current live status. */
  //update
  statusReason: string;
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
  log: { clockIn: Date | null; clockOut: Date | null; status?: string | null },
  hasOpenBreak: boolean,
  hasOpenUnscheduledBreak: boolean
): LiveAttendanceStatus {
  if (!log.clockIn || log.clockOut) return "offline";
  if (hasOpenUnscheduledBreak) return "idle";
  if (hasOpenBreak) return "break";
  if (log.status === "idle") return "idle";
  return "active";
}

function toIso(d: Date | null): string | null {
  if (!d) return null;
  return new Date(d as Date).toISOString();
}

function toShortClock(d: Date | null): string {
  if (!d) return "-";
  return new Date(d as Date).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit"
  });
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

function latestClosedUnscheduledBreak(sessions: BreakRow[]): BreakRow | null {
  const closed = sessions.filter(
    (s) => s.breakType === "unscheduled" && s.breakEnd
  );
  if (closed.length === 0) return null;
  return closed.reduce((a, b) =>
    new Date(a.breakEnd as Date).getTime() > new Date(b.breakEnd as Date).getTime() ? a : b
  );
}

function buildStatusReason(params: {
  status: LiveAttendanceStatus;
  log: typeof schema.attendanceLogs.$inferSelect;
  openBreak: BreakRow | undefined;
  sessions: BreakRow[];
}): string {
  const { status, log, openBreak, sessions } = params;
  const source = (log.lastActivitySource ?? "").toLowerCase();
  const via = source === "agent" ? "desktop agent" : "browser";

  if (status === "offline") {
    if (!log.clockIn) return "Not clocked in today.";
    if (log.clockOut) return `Checked out at ${toShortClock(log.clockOut as Date)}.`;
    return "Shift is not active.";
  }

  if (status === "break") {
    if (openBreak?.breakType === "manual") {
      return `On official break since ${toShortClock(openBreak.breakStart as Date)}.`;
    }
    if (openBreak?.unscheduledCause === UNSCHEDULED_CAUSE.SLEEP) {
      return `Laptop lock/sleep detected automatically since ${toShortClock(openBreak.breakStart as Date)}.`;
    }
    return `Away detected automatically by ${via} since ${toShortClock(openBreak?.breakStart as Date | null)}.`;
  }

  if (status === "idle") {
    if (openBreak?.unscheduledCause === UNSCHEDULED_CAUSE.SLEEP) {
      return "Laptop lock/sleep detected during duty.";
    }
    if (source === "agent") {
      return "No activity detected by desktop agent (auto away).";
    }
    return "No activity detected in attendance page (auto away).";
  }

  const lastClosedUnscheduled = latestClosedUnscheduledBreak(sessions);
  if (lastClosedUnscheduled?.returnReason) {
    return `Back to work. Return reason: ${lastClosedUnscheduled.returnReason}`;
  }
  if (log.lastActivityAt) {
    return `Working. Last activity at ${toShortClock(log.lastActivityAt as Date)} via ${via}.`;
  }
  return "Working normally.";
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
        statusReason: "Not clocked in today.",
        clockIn: null,
        clockOut: null,
        breakStart: null,
        breakEnd: null,
        breakIsOpen: false
      };
    }
    const openBreak = openBreakByLogId.get(log.id);
    const openUnscheduledBreak = Boolean(
      openBreak && openBreak.breakType === "unscheduled"
    );
    const status = statusForLog(
      { clockIn: log.clockIn, clockOut: log.clockOut, status: log.status },
      Boolean(openBreak),
      openUnscheduledBreak
    );
    const sessionRows = breaksByLogId.get(log.id) ?? [];
    const { breakStart, breakEnd, breakIsOpen } = resolveBreakTimesForLiveView(sessionRows);
    const statusReason = buildStatusReason({
      status,
      log,
      openBreak,
      sessions: sessionRows
    });
    return {
      userId: user.id,
      name: user.name,
      email: user.email,
      status,
      statusReason,
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
  let idle = 0;
  let offline = 0;
  for (const p of people) {
    if (p.status === "active") active += 1;
    else if (p.status === "break") onBreak += 1;
    else if (p.status === "idle") idle += 1;
    else offline += 1;
  }
  return { active, onBreak, idle, offline, openShift: active + onBreak + idle };
}
