import { and, desc, eq, gte, inArray, isNotNull, isNull, lte } from "drizzle-orm";

import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { breakSessionReasonLabel } from "@/lib/attendance-break-label";
import {
  pickLatestAgentSignalOnDate,
  resolveAgentHealthState,
  type AgentHealthState
} from "@/lib/attendance-agent-health-state";
import { autoClockOutDueOpenShifts } from "@/lib/attendance-auto-clock-out";
import { computeDayTotalsFromSessions } from "@/lib/attendance-shift-minutes";
import { resolveOpenShiftBoundsForEmployee } from "@/lib/attendance-shift-window";
import {
  buildAttendanceReason,
  UNSCHEDULED_CAUSE,
  type AttendanceStatusKind,
  type UnscheduledCause
} from "@/lib/attendance-reason";
import { labelForDisplayAgentState } from "@/lib/attendance-agent-health-display";

export type AttendanceEmployeeBreakRow = {
  id: number;
  logDate: string;
  breakStart: string;
  breakEnd: string | null;
  breakType: string;
  unscheduledCause: string | null;
  returnReason: string | null;
  reasonLabel: string;
  durationMinutes: number | null;
};

export type AttendanceEmployeeDetail = {
  userId: number;
  userName: string;
  userEmail: string;
  departmentName: string | null;
  date: string;
  hasLog: boolean;
  clockIn: string | null;
  clockOut: string | null;
  attendanceStatus: AttendanceStatusKind;
  attendanceReason: string;
  agentState: AgentHealthState;
  agentStateLabel: string;
  lastAgentActivityAt: string | null;
  lastAgentAgeSeconds: number | null;
  openShift: boolean;
  lastActivityAt: string | null;
  lastActivitySource: string | null;
  totalWorkMinutes: number;
  totalBreakMinutes: number;
  unscheduledIdleMinutes: number;
  idleEventsCount: number;
  sleepMinutes: number;
  sleepEventsCount: number;
  totalHours: string | null;
  breakSessions: AttendanceEmployeeBreakRow[];
  breakRangeFrom: string;
  breakRangeTo: string;
};

function formatDurationMinutes(start: Date, end: Date | null): number | null {
  if (!end) return null;
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
}

function agentStateLabel(state: AgentHealthState): string {
  return labelForDisplayAgentState(state);
}

function normalizeRange(from: string, to: string): { from: string; to: string } {
  return from <= to ? { from, to } : { from: to, to: from };
}

async function loadBreakSessionsInRange(
  userId: number,
  rangeFrom: string,
  rangeTo: string
): Promise<AttendanceEmployeeBreakRow[]> {
  const logs = await db
    .select({ id: schema.attendanceLogs.id, date: schema.attendanceLogs.date })
    .from(schema.attendanceLogs)
    .where(
      and(
        eq(schema.attendanceLogs.userId, userId),
        gte(schema.attendanceLogs.date, rangeFrom as any),
        lte(schema.attendanceLogs.date, rangeTo as any)
      )
    );

  if (logs.length === 0) return [];

  const logDateById = new Map(logs.map((row) => [row.id, String(row.date)]));
  const logIds = logs.map((row) => row.id);

  const breakRows = await db
    .select()
    .from(schema.breakSessions)
    .where(inArray(schema.breakSessions.attendanceLogId, logIds))
    .orderBy(desc(schema.breakSessions.breakStart));

  return breakRows.map((row) => {
    const start = new Date(row.breakStart as Date);
    const end = row.breakEnd ? new Date(row.breakEnd as Date) : null;
    return {
      id: row.id,
      logDate: logDateById.get(row.attendanceLogId) ?? rangeFrom,
      breakStart: start.toISOString(),
      breakEnd: end?.toISOString() ?? null,
      breakType: row.breakType,
      unscheduledCause: row.unscheduledCause,
      returnReason: row.returnReason,
      reasonLabel: breakSessionReasonLabel(row),
      durationMinutes: formatDurationMinutes(start, end)
    };
  });
}

export async function getAttendanceEmployeeDetail(params: {
  userId: number;
  date: string;
  breakFrom?: string;
  breakTo?: string;
  scope: { role: "admin" | "manager"; departmentId: number | null };
}): Promise<AttendanceEmployeeDetail | null> {
  const { userId, date, scope } = params;
  const range = normalizeRange(params.breakFrom ?? date, params.breakTo ?? date);

  const [user] = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      departmentId: schema.users.departmentId,
      departmentName: schema.departments.name
    })
    .from(schema.users)
    .leftJoin(schema.departments, eq(schema.users.departmentId, schema.departments.id))
    .where(eq(schema.users.id, userId))
    .limit(1);

  if (!user) return null;
  if (scope.role === "manager" && user.departmentId !== scope.departmentId) {
    return null;
  }

  await autoClockOutDueOpenShifts({ userId });

  const [log, heartbeatRows, setupRows, breakSessions] = await Promise.all([
    db
      .select()
      .from(schema.attendanceLogs)
      .where(
        and(eq(schema.attendanceLogs.userId, userId), eq(schema.attendanceLogs.date, date as any))
      )
      .limit(1)
      .then((rows) => rows[0]),
    db
      .select({ createdAt: schema.activityLogs.createdAt })
      .from(schema.activityLogs)
      .where(
        and(
          eq(schema.activityLogs.userId, userId),
          eq(schema.activityLogs.entityType, "attendance_agent"),
          eq(schema.activityLogs.action, "agent_heartbeat"),
          eq(schema.activityLogs.entityId, 0)
        )
      )
      .orderBy(desc(schema.activityLogs.createdAt))
      .limit(100),
    db
      .select({ createdAt: schema.activityLogs.createdAt })
      .from(schema.activityLogs)
      .where(
        and(
          eq(schema.activityLogs.userId, userId),
          eq(schema.activityLogs.entityType, "attendance_agent"),
          eq(schema.activityLogs.action, "agent_setup_prepared"),
          eq(schema.activityLogs.entityId, 0)
        )
      )
      .orderBy(desc(schema.activityLogs.createdAt))
      .limit(1),
    loadBreakSessionsInRange(userId, range.from, range.to)
  ]);

  const latestAgentLogAt =
    (log?.lastActivitySource === "agent" || log?.lastActivitySource === "electron") &&
    log.lastActivityAt
      ? new Date(log.lastActivityAt as Date)
      : null;
  const heartbeatDates = heartbeatRows
    .map((row) => (row.createdAt ? new Date(row.createdAt as Date) : null))
    .filter((value): value is Date => value != null);
  const latestAgentAt = pickLatestAgentSignalOnDate(date, [
    latestAgentLogAt,
    ...heartbeatDates
  ]);
  const latestSetupAt = setupRows[0]?.createdAt
    ? new Date(setupRows[0].createdAt as Date)
    : null;
  const openShiftEarly = Boolean(log?.clockIn && !log?.clockOut);
  const { state: agentState, ageSeconds: lastAgentAgeSeconds } = resolveAgentHealthState({
    lastAgentAtOnDate: latestAgentAt,
    lastSetupAt: latestSetupAt,
    openShift: openShiftEarly
  });

  if (!log) {
    return {
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      departmentName: user.departmentName ?? null,
      date,
      hasLog: false,
      clockIn: null,
      clockOut: null,
      attendanceStatus: "offline",
      attendanceReason: buildAttendanceReason({
        attendanceStatus: "offline",
        clockOut: null
      }),
      agentState,
      agentStateLabel: agentStateLabel(agentState),
      lastAgentActivityAt: latestAgentAt?.toISOString() ?? null,
      lastAgentAgeSeconds,
      openShift: false,
      lastActivityAt: null,
      lastActivitySource: null,
      totalWorkMinutes: 0,
      totalBreakMinutes: 0,
      unscheduledIdleMinutes: 0,
      idleEventsCount: 0,
      sleepMinutes: 0,
      sleepEventsCount: 0,
      totalHours: null,
      breakSessions,
      breakRangeFrom: range.from,
      breakRangeTo: range.to
    };
  }

  const [openUnscheduled] = await db
    .select({ unscheduledCause: schema.breakSessions.unscheduledCause })
    .from(schema.breakSessions)
    .where(
      and(
        eq(schema.breakSessions.attendanceLogId, log.id),
        eq(schema.breakSessions.breakType, "unscheduled"),
        isNull(schema.breakSessions.breakEnd)
      )
    )
    .limit(1);

  const openCause = openUnscheduled?.unscheduledCause;
  const openUnscheduledCause: UnscheduledCause | undefined =
    openCause === UNSCHEDULED_CAUSE.SLEEP
      ? UNSCHEDULED_CAUSE.SLEEP
      : openCause === UNSCHEDULED_CAUSE.TAB_CLOSE
        ? UNSCHEDULED_CAUSE.TAB_CLOSE
        : openCause === UNSCHEDULED_CAUSE.CURSOR_IDLE
          ? UNSCHEDULED_CAUSE.CURSOR_IDLE
          : openCause === UNSCHEDULED_CAUSE.IDLE
            ? UNSCHEDULED_CAUSE.IDLE
            : undefined;

  const statusRaw = (log.status ?? "offline").toLowerCase();
  const attendanceStatus: AttendanceStatusKind =
    statusRaw === "active" || statusRaw === "break" || statusRaw === "idle"
      ? statusRaw
      : "offline";

  const openShift = Boolean(log.clockIn && !log.clockOut);
  const attendanceReason = buildAttendanceReason({
    attendanceStatus,
    clockOut: log.clockOut,
    openUnscheduledCause,
    lastActivitySource: log.lastActivitySource,
    lastActivityAt: log.lastActivityAt
  });

  const daySessions = breakSessions.filter((row) => row.logDate === date);
  const sessionInputs = daySessions.map((row) => ({
    breakStart: row.breakStart,
    breakEnd: row.breakEnd,
    breakType: row.breakType,
    unscheduledCause: row.unscheduledCause
  }));

  const totals =
    log.clockIn != null
      ? await (async () => {
          const now = new Date();
          const bounds = log.clockOut
            ? null
            : await resolveOpenShiftBoundsForEmployee({
                userId,
                logDate: date,
                clockIn: new Date(log.clockIn as Date),
                clockOut: null,
                now
              });
          return computeDayTotalsFromSessions({
            clockIn: log.clockIn as Date,
            clockOut: log.clockOut as Date | null,
            now,
            calculationStart: bounds?.start,
            calculationEnd: bounds?.end,
            breakSessions: sessionInputs
          });
        })()
      : null;

  const totalWorkMinutes = totals?.workMinutes ?? log.totalWorkMinutes ?? 0;
  const totalBreakMinutes = totals?.breakMinutes ?? log.totalBreakMinutes ?? 0;
  const unscheduledIdleMinutes =
    totals != null
      ? totals.inactiveMinutes + totals.sleepMinutes
      : log.unscheduledIdleMinutes ?? 0;
  const sleepMinutes = totals?.sleepMinutes ?? log.sleepMinutes ?? 0;
  const inactiveOnlyMinutes = totals?.inactiveMinutes ?? Math.max(0, unscheduledIdleMinutes - sleepMinutes);

  const inactiveEventsCount = Math.max(
    totals?.inactiveEventsCount ?? 0,
    (log.tabCloseEventsCount ?? 0) + (log.cursorAwayEventsCount ?? 0) + (log.idleEventsCount ?? 0)
  );
  const sleepEventsCount = Math.max(
    totals?.sleepEventsCount ?? 0,
    log.sleepEventsCount ?? 0
  );

  const totalHours =
    log.clockOut && log.totalHours != null
      ? String(log.totalHours)
      : totals && totals.workMinutes > 0
        ? (totals.workMinutes / 60).toFixed(2)
        : null;

  return {
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    departmentName: user.departmentName ?? null,
    date,
    hasLog: true,
    clockIn: log.clockIn ? new Date(log.clockIn as Date).toISOString() : null,
    clockOut: log.clockOut ? new Date(log.clockOut as Date).toISOString() : null,
    attendanceStatus,
    attendanceReason,
    agentState,
    agentStateLabel: agentStateLabel(agentState),
    lastAgentActivityAt: latestAgentAt?.toISOString() ?? null,
    lastAgentAgeSeconds,
    openShift,
    lastActivityAt: log.lastActivityAt
      ? new Date(log.lastActivityAt as Date).toISOString()
      : null,
    lastActivitySource: log.lastActivitySource,
    totalWorkMinutes,
    totalBreakMinutes,
    unscheduledIdleMinutes: inactiveOnlyMinutes,
    idleEventsCount: inactiveEventsCount,
    sleepMinutes,
    sleepEventsCount,
    totalHours,
    breakSessions,
    breakRangeFrom: range.from,
    breakRangeTo: range.to
  };
}
