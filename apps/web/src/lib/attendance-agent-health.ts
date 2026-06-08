import { and, asc, eq, inArray, isNotNull, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { UNSCHEDULED_CAUSE, type UnscheduledCause } from "@/lib/attendance-reason";
import { getLocalDateString } from "@/lib/attendance-date";
import {
  pickLatestAgentSignalOnDate,
  resolveAgentHealthState,
  type AgentHealthState
} from "@/lib/attendance-agent-health-state";
import { buildAttendanceReason } from "@/lib/attendance-reason";
import { ATTENDANCE_AGENT_ALERT_STALE_MINUTES } from "@/lib/attendance-policy";

export type { AgentHealthState };

export type AttendanceAgentHealthRow = {
  userId: number;
  userName: string;
  userEmail: string;
  departmentId: number | null;
  departmentName: string | null;
  openShift: boolean;
  attendanceStatus: "active" | "break" | "idle" | "offline";
  attendanceReason: string;
  sleepMinutes: number;
  lastAgentActivityAt: string | null;
  lastAgentActivitySource: string | null;
  lastAgentAgeSeconds: number | null;
  lastSeenAt: string | null;
  lastSeenSource: string | null;
  lastSeenAgeSeconds: number | null;
  state: AgentHealthState;
  needsAttention: boolean;
};

export async function getAttendanceAgentHealth(params: {
  date: string;
  scope: { role: "admin" | "manager"; departmentId: number | null };
  search?: string;
  departmentFilter?: number | null;
  stateFilter?: AgentHealthState | "all";
  alertsOnly?: boolean;
}): Promise<{
  rows: AttendanceAgentHealthRow[];
  counts: Record<AgentHealthState, number>;
}> {
  const {
    date,
    scope,
    search = "",
    departmentFilter = null,
    stateFilter = "all",
    alertsOnly = false
  } = params;

  const scopedUsers = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      departmentId: schema.users.departmentId,
      departmentName: schema.departments.name
    })
    .from(schema.users)
    .leftJoin(schema.departments, eq(schema.users.departmentId, schema.departments.id))
    .where(
      scope.role === "manager"
        ? eq(schema.users.departmentId, scope.departmentId as number)
        : undefined
    )
    .orderBy(asc(schema.users.name));

  if (scopedUsers.length === 0) {
    return {
      rows: [],
      counts: { not_installed: 0, installed: 0, running: 0, stale: 0 }
    };
  }

  const userIds = scopedUsers.map((u) => u.id);
  const todayLogs = await db
    .select({
      logId: schema.attendanceLogs.id,
      userId: schema.attendanceLogs.userId,
      clockIn: schema.attendanceLogs.clockIn,
      clockOut: schema.attendanceLogs.clockOut,
      status: schema.attendanceLogs.status,
      lastActivityAt: schema.attendanceLogs.lastActivityAt,
      lastActivitySource: schema.attendanceLogs.lastActivitySource,
      sleepMinutes: schema.attendanceLogs.sleepMinutes
    })
    .from(schema.attendanceLogs)
    .where(
      and(
        inArray(schema.attendanceLogs.userId, userIds),
        eq(schema.attendanceLogs.date, date as any)
      )
    );

  const heartbeatLogs = await db
    .select({
      userId: schema.activityLogs.userId,
      createdAt: schema.activityLogs.createdAt
    })
    .from(schema.activityLogs)
    .where(
      and(
        inArray(schema.activityLogs.userId, userIds),
        eq(schema.activityLogs.entityType, "attendance_agent"),
        eq(schema.activityLogs.action, "agent_heartbeat"),
        eq(schema.activityLogs.entityId, 0)
      )
    );

  const setupLogs = await db
    .select({
      userId: schema.activityLogs.userId,
      createdAt: schema.activityLogs.createdAt
    })
    .from(schema.activityLogs)
    .where(
      and(
        inArray(schema.activityLogs.userId, userIds),
        eq(schema.activityLogs.entityType, "attendance_agent"),
        eq(schema.activityLogs.action, "agent_setup_prepared"),
        eq(schema.activityLogs.entityId, 0)
      )
    );

  const logIds = todayLogs.map((l) => l.logId);
  const openUnscheduledByLogId = new Map<number, UnscheduledCause>();
  if (logIds.length > 0) {
    const openUnscheduled = await db
      .select({
        attendanceLogId: schema.breakSessions.attendanceLogId,
        unscheduledCause: schema.breakSessions.unscheduledCause
      })
      .from(schema.breakSessions)
      .where(
        and(
          inArray(schema.breakSessions.attendanceLogId, logIds),
          eq(schema.breakSessions.breakType, "unscheduled"),
          isNull(schema.breakSessions.breakEnd)
        )
      );
    for (const row of openUnscheduled) {
      openUnscheduledByLogId.set(
        row.attendanceLogId,
        row.unscheduledCause === UNSCHEDULED_CAUSE.SLEEP
          ? UNSCHEDULED_CAUSE.SLEEP
          : UNSCHEDULED_CAUSE.IDLE
      );
    }
  }

  const todayByUser = new Map(todayLogs.map((l) => [l.userId, l]));
  const latestAgentByUser = new Map<number, Date>();
  const latestSetupByUser = new Map<number, Date>();
  const heartbeatsByUser = new Map<number, Date[]>();
  for (const row of heartbeatLogs) {
    if (!row.createdAt) continue;
    const next = new Date(row.createdAt as Date);
    if (getLocalDateString(next) !== date) continue;
    const list = heartbeatsByUser.get(row.userId) ?? [];
    list.push(next);
    heartbeatsByUser.set(row.userId, list);
  }
  for (const todayLog of todayLogs) {
    const fromLog =
      todayLog.lastActivitySource === "agent" && todayLog.lastActivityAt
        ? new Date(todayLog.lastActivityAt as Date)
        : null;
    const lastAgentAt = pickLatestAgentSignalOnDate(date, [
      fromLog,
      ...(heartbeatsByUser.get(todayLog.userId) ?? [])
    ]);
    if (lastAgentAt) {
      latestAgentByUser.set(todayLog.userId, lastAgentAt);
    }
  }
  for (const [userId, beats] of heartbeatsByUser) {
    if (latestAgentByUser.has(userId)) continue;
    const lastAgentAt = pickLatestAgentSignalOnDate(date, beats);
    if (lastAgentAt) {
      latestAgentByUser.set(userId, lastAgentAt);
    }
  }
  for (const row of setupLogs) {
    if (!row.createdAt) continue;
    const current = latestSetupByUser.get(row.userId);
    const next = new Date(row.createdAt as Date);
    if (!current || next.getTime() > current.getTime()) {
      latestSetupByUser.set(row.userId, next);
    }
  }

  const normalizedSearch = search.trim().toLowerCase();
  const now = Date.now();
  const rows = scopedUsers
    .map((user) => {
      const todayLog = todayByUser.get(user.id);
      const openShift = Boolean(todayLog?.clockIn && !todayLog?.clockOut);
      const statusRaw = (todayLog?.status ?? "offline").toLowerCase();
      const attendanceStatus =
        statusRaw === "active" || statusRaw === "break" || statusRaw === "idle"
          ? (statusRaw as "active" | "break" | "idle")
          : "offline";
      const openUnscheduledCause = todayLog
        ? openUnscheduledByLogId.get(todayLog.logId)
        : undefined;
      const attendanceReason = buildAttendanceReason({
        attendanceStatus,
        clockOut: todayLog?.clockOut ?? null,
        openUnscheduledCause,
        lastActivitySource: todayLog?.lastActivitySource,
        lastActivityAt: todayLog?.lastActivityAt
      });

      const lastAgentAt = latestAgentByUser.get(user.id) ?? null;
      const lastSetupAt = latestSetupByUser.get(user.id) ?? null;
      const todayActivityAt = todayLog?.lastActivityAt
        ? new Date(todayLog.lastActivityAt as Date)
        : null;
      const fallbackSetupSeenAt = lastAgentAt ? null : lastSetupAt;
      const agentOrSetupSeenAt =
        lastAgentAt && fallbackSetupSeenAt
          ? lastAgentAt.getTime() >= fallbackSetupSeenAt.getTime()
            ? lastAgentAt
            : fallbackSetupSeenAt
          : lastAgentAt ?? fallbackSetupSeenAt ?? null;
      const lastSeenAt =
        todayActivityAt && agentOrSetupSeenAt
          ? todayActivityAt.getTime() >= agentOrSetupSeenAt.getTime()
            ? todayActivityAt
            : agentOrSetupSeenAt
          : todayActivityAt ?? agentOrSetupSeenAt ?? null;
      const lastSeenSource =
        todayActivityAt && lastSeenAt?.getTime() === todayActivityAt.getTime()
          ? todayLog?.lastActivitySource ?? "browser"
          : lastAgentAt && lastSeenAt?.getTime() === lastAgentAt.getTime()
            ? "agent"
            : fallbackSetupSeenAt && lastSeenAt?.getTime() === fallbackSetupSeenAt.getTime()
              ? "setup"
            : null;
      const lastSeenAgeSeconds = lastSeenAt
        ? Math.max(0, Math.floor((now - lastSeenAt.getTime()) / 1000))
        : null;
      const { state, ageSeconds } = resolveAgentHealthState({
        lastAgentAtOnDate: lastAgentAt,
        lastSetupAt,
        openShift
      });
      const needsAttention =
        openShift &&
        lastSeenAgeSeconds != null &&
        lastSeenAgeSeconds >= ATTENDANCE_AGENT_ALERT_STALE_MINUTES * 60;
      return {
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        departmentId: user.departmentId,
        departmentName: user.departmentName ?? null,
        openShift,
        attendanceStatus,
        attendanceReason,
        sleepMinutes: todayLog?.sleepMinutes ?? 0,
        lastAgentActivityAt: lastAgentAt ? lastAgentAt.toISOString() : null,
        lastAgentActivitySource: todayLog?.lastActivitySource ?? null,
        lastAgentAgeSeconds: ageSeconds,
        lastSeenAt: lastSeenAt ? lastSeenAt.toISOString() : null,
        lastSeenSource,
        lastSeenAgeSeconds,
        state,
        needsAttention
      } satisfies AttendanceAgentHealthRow;
    })
    .filter((row) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        row.userName.toLowerCase().includes(normalizedSearch) ||
        row.userEmail.toLowerCase().includes(normalizedSearch);
      const matchesDepartment =
        departmentFilter == null || row.departmentId === departmentFilter;
      const matchesState = stateFilter === "all" || row.state === stateFilter;
      const matchesAlerts = !alertsOnly || row.needsAttention;
      return matchesSearch && matchesDepartment && matchesState && matchesAlerts;
    });

  const counts: Record<AgentHealthState, number> = {
    not_installed: 0,
    installed: 0,
    running: 0,
    stale: 0
  };
  for (const row of rows) {
    counts[row.state] += 1;
  }

  return { rows, counts };
}
