import { and, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { formatAttendanceClock, formatAttendanceDurationReadable } from "@/lib/attendance-date";
import { schema } from "@asbatechs-crm/database";
import {
  ATTENDANCE_CURSOR_IDLE_ENABLED,
  ATTENDANCE_CURSOR_IDLE_AWAY_MS,
  ATTENDANCE_LAPTOP_SLEEP_AWAY_MS,
  ATTENDANCE_TAB_CLOSE_AWAY_MS
} from "@/lib/attendance-policy";
import {
  UNSCHEDULED_CAUSE,
  type UnscheduledCause
} from "@/lib/attendance-reason";

export type ComplianceAwayCause =
  | typeof UNSCHEDULED_CAUSE.TAB_CLOSE
  | typeof UNSCHEDULED_CAUSE.CURSOR_IDLE
  | typeof UNSCHEDULED_CAUSE.SLEEP;

export function getAwayThresholdMs(cause: ComplianceAwayCause): number {
  if (cause === UNSCHEDULED_CAUSE.TAB_CLOSE) return ATTENDANCE_TAB_CLOSE_AWAY_MS;
  if (cause === UNSCHEDULED_CAUSE.CURSOR_IDLE) return ATTENDANCE_CURSOR_IDLE_AWAY_MS;
  return ATTENDANCE_LAPTOP_SLEEP_AWAY_MS;
}

export function awayCauseLabel(cause: ComplianceAwayCause): string {
  if (cause === UNSCHEDULED_CAUSE.TAB_CLOSE) return "Attendance tab closed";
  if (cause === UNSCHEDULED_CAUSE.CURSOR_IDLE) return "No cursor movement";
  return "Laptop sleep/lock";
}

/** System-generated reason stored for admin (employee does not type). */
export function buildAutoAwayReason(
  cause: ComplianceAwayCause,
  awaySeconds: number,
  _source: "browser" | "agent" | "system" = "system"
): string {
  const duration = formatAwayDuration(awaySeconds);
  if (cause === UNSCHEDULED_CAUSE.TAB_CLOSE) {
    return `Attendance tab closed for ${duration}.`;
  }
  if (cause === UNSCHEDULED_CAUSE.CURSOR_IDLE) {
    return `No mouse or keyboard for ${duration}.`;
  }
  return `Laptop locked or asleep for ${duration}.`;
}

function isComplianceAwayCause(value: string | null | undefined): value is ComplianceAwayCause {
  return (
    value === UNSCHEDULED_CAUSE.TAB_CLOSE ||
    value === UNSCHEDULED_CAUSE.CURSOR_IDLE ||
    value === UNSCHEDULED_CAUSE.SLEEP
  );
}

function minutesBetween(start: Date, end: Date): number {
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 60000));
}

function formatAwayDuration(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  if (safeSeconds < 60) {
    return safeSeconds === 1 ? "1 second" : `${safeSeconds} seconds`;
  }
  const minutes = Math.floor(safeSeconds / 60);
  const rem = safeSeconds % 60;
  const minutePart = formatAttendanceDurationReadable(minutes);
  if (rem === 0) return minutePart;
  const secondPart = rem === 1 ? "1 second" : `${rem} seconds`;
  return `${minutePart} ${secondPart}`;
}

async function notifyAdminsAwayAlert(params: {
  employeeUserId: number;
  employeeName: string;
  cause: ComplianceAwayCause;
  awaySeconds: number;
  breakSessionId: number;
}) {
  const { employeeUserId, employeeName, cause, awaySeconds, breakSessionId } = params;
  const [existing] = await db
    .select({ id: schema.activityLogs.id })
    .from(schema.activityLogs)
    .where(
      and(
        eq(schema.activityLogs.userId, employeeUserId),
        eq(schema.activityLogs.action, "attendance_away_admin_alert"),
        eq(schema.activityLogs.entityType, "break_session"),
        eq(schema.activityLogs.entityId, breakSessionId)
      )
    )
    .limit(1);

  if (existing) return;

  const admins = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.role, "admin"));

  const autoReason = buildAutoAwayReason(cause, awaySeconds, "system");
  const message = `${employeeName} — ${autoReason}`;

  for (const admin of admins) {
    await db.insert(schema.notifications).values({
      userId: admin.id,
      type: "attendance_away_alert",
      leadId: null,
      message
    });
  }

  await db.insert(schema.activityLogs).values({
    userId: employeeUserId,
    action: "attendance_away_admin_alert",
    entityType: "break_session",
    entityId: breakSessionId
  });
}

async function notifyAdminsTabBrowserClosed(params: {
  employeeUserId: number;
  employeeName: string;
  closedAt: Date;
  breakSessionId: number;
}) {
  const { employeeUserId, employeeName, closedAt, breakSessionId } = params;
  const [existing] = await db
    .select({ id: schema.activityLogs.id })
    .from(schema.activityLogs)
    .where(
      and(
        eq(schema.activityLogs.userId, employeeUserId),
        eq(schema.activityLogs.action, "attendance_tab_close_admin"),
        eq(schema.activityLogs.entityType, "break_session"),
        eq(schema.activityLogs.entityId, breakSessionId)
      )
    )
    .limit(1);

  if (existing) return;

  const closedLabel = formatAttendanceClock(closedAt);
  const message = `${employeeName} closed the attendance tab at ${closedLabel}.`;

  const admins = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.role, "admin"));

  for (const admin of admins) {
    await db.insert(schema.notifications).values({
      userId: admin.id,
      type: "attendance_away_alert",
      leadId: null,
      message
    });
  }

  await db.insert(schema.activityLogs).values({
    userId: employeeUserId,
    action: "attendance_tab_close_admin",
    entityType: "break_session",
    entityId: breakSessionId
  });
}

async function notifyAdminsTabBrowserReturned(params: {
  employeeUserId: number;
  employeeName: string;
  awaySeconds: number;
  breakSessionId: number;
}) {
  const { employeeUserId, employeeName, awaySeconds, breakSessionId } = params;
  const [existing] = await db
    .select({ id: schema.activityLogs.id })
    .from(schema.activityLogs)
    .where(
      and(
        eq(schema.activityLogs.userId, employeeUserId),
        eq(schema.activityLogs.action, "attendance_tab_return_admin"),
        eq(schema.activityLogs.entityType, "break_session"),
        eq(schema.activityLogs.entityId, breakSessionId)
      )
    )
    .limit(1);

  if (existing) return;

  const duration = formatAwayDuration(awaySeconds);
  const message = `${employeeName} returned to the attendance tab after ${duration}.`;

  const admins = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.role, "admin"));

  for (const admin of admins) {
    await db.insert(schema.notifications).values({
      userId: admin.id,
      type: "attendance_away_alert",
      leadId: null,
      message
    });
  }

  await db.insert(schema.activityLogs).values({
    userId: employeeUserId,
    action: "attendance_tab_return_admin",
    entityType: "break_session",
    entityId: breakSessionId
  });
}

export async function maybeAlertAdminsForOpenAway(params: {
  employeeUserId: number;
  employeeName: string;
  attendanceLogId: number;
  openSession: {
    id: number;
    breakStart: Date;
    unscheduledCause: string | null;
  };
  now?: Date;
}): Promise<{ alerted: boolean; awaySeconds: number }> {
  const cause = params.openSession.unscheduledCause;
  if (!isComplianceAwayCause(cause)) {
    return { alerted: false, awaySeconds: 0 };
  }
  if (cause === UNSCHEDULED_CAUSE.TAB_CLOSE) {
    return { alerted: false, awaySeconds: 0 };
  }

  const now = params.now ?? new Date();
  const awaySeconds = Math.max(
    0,
    Math.floor((now.getTime() - params.openSession.breakStart.getTime()) / 1000)
  );
  if (awaySeconds * 1000 < getAwayThresholdMs(cause)) {
    return { alerted: false, awaySeconds };
  }

  await notifyAdminsAwayAlert({
    employeeUserId: params.employeeUserId,
    employeeName: params.employeeName,
    cause,
    awaySeconds,
    breakSessionId: params.openSession.id
  });

  return { alerted: true, awaySeconds };
}

export async function startComplianceAway(params: {
  attendanceLogId: number;
  cause: ComplianceAwayCause;
  eventAt: Date;
  hasOpenManualBreak: boolean;
  employeeUserId?: number;
  employeeName?: string;
}): Promise<{ started: boolean; sessionId?: number }> {
  /* FUTURE: mouse/keyboard idle — remove this guard when ATTENDANCE_CURSOR_IDLE_ENABLED is true */
  if (!ATTENDANCE_CURSOR_IDLE_ENABLED && params.cause === UNSCHEDULED_CAUSE.CURSOR_IDLE) {
    return { started: false };
  }

  if (params.hasOpenManualBreak) {
    return { started: false };
  }

  const [existing] = await db
    .select()
    .from(schema.breakSessions)
    .where(
      and(
        eq(schema.breakSessions.attendanceLogId, params.attendanceLogId),
        isNull(schema.breakSessions.breakEnd)
      )
    )
    .limit(1);

  if (existing) {
    if (existing.breakType === "unscheduled" && existing.unscheduledCause !== params.cause) {
      await db
        .update(schema.breakSessions)
        .set({ unscheduledCause: params.cause })
        .where(eq(schema.breakSessions.id, existing.id));
    }
    return { started: false, sessionId: existing.id };
  }

  const [inserted] = await db
    .insert(schema.breakSessions)
    .values({
      attendanceLogId: params.attendanceLogId,
      breakStart: params.eventAt,
      breakType: "unscheduled",
      unscheduledCause: params.cause
    })
    .returning({ id: schema.breakSessions.id });

  if (params.cause === UNSCHEDULED_CAUSE.TAB_CLOSE) {
    await db
      .update(schema.attendanceLogs)
      .set({
        status: "idle",
        tabCloseEventsCount: sql`${schema.attendanceLogs.tabCloseEventsCount} + 1`
      })
      .where(eq(schema.attendanceLogs.id, params.attendanceLogId));
  } else if (params.cause === UNSCHEDULED_CAUSE.CURSOR_IDLE) {
    await db
      .update(schema.attendanceLogs)
      .set({
        status: "idle",
        cursorAwayEventsCount: sql`${schema.attendanceLogs.cursorAwayEventsCount} + 1`
      })
      .where(eq(schema.attendanceLogs.id, params.attendanceLogId));
  } else {
    await db
      .update(schema.attendanceLogs)
      .set({
        status: "idle",
        sleepEventsCount: sql`${schema.attendanceLogs.sleepEventsCount} + 1`
      })
      .where(eq(schema.attendanceLogs.id, params.attendanceLogId));
  }

  const sessionId = inserted?.id;
  if (
    params.cause === UNSCHEDULED_CAUSE.TAB_CLOSE &&
    sessionId != null &&
    params.employeeUserId != null &&
    params.employeeName
  ) {
    await notifyAdminsTabBrowserClosed({
      employeeUserId: params.employeeUserId,
      employeeName: params.employeeName,
      closedAt: params.eventAt,
      breakSessionId: sessionId
    });
  }

  return { started: true, sessionId };
}

export async function endComplianceAway(params: {
  attendanceLogId: number;
  employeeUserId: number;
  employeeName: string;
  cause: ComplianceAwayCause;
  eventAt: Date;
  reason: string | null;
  source: "browser" | "agent";
}): Promise<{
  ok: boolean;
  awaySeconds?: number;
  addedMinutes?: number;
  autoReason?: string;
}> {
  /* FUTURE: mouse/keyboard idle — remove this guard when ATTENDANCE_CURSOR_IDLE_ENABLED is true */
  if (!ATTENDANCE_CURSOR_IDLE_ENABLED && params.cause === UNSCHEDULED_CAUSE.CURSOR_IDLE) {
    return { ok: true, addedMinutes: 0 };
  }

  const [openSession] = await db
    .select()
    .from(schema.breakSessions)
    .where(
      and(
        eq(schema.breakSessions.attendanceLogId, params.attendanceLogId),
        isNull(schema.breakSessions.breakEnd),
        eq(schema.breakSessions.breakType, "unscheduled"),
        eq(schema.breakSessions.unscheduledCause, params.cause)
      )
    )
    .limit(1);

  if (!openSession) {
    return { ok: true, addedMinutes: 0 };
  }

  const awaySeconds = Math.max(
    0,
    Math.floor(
      (params.eventAt.getTime() - new Date(openSession.breakStart as Date).getTime()) / 1000
    )
  );
  const thresholdMs = getAwayThresholdMs(params.cause);
  const exceeded = awaySeconds * 1000 >= thresholdMs;
  const autoReason = buildAutoAwayReason(params.cause, awaySeconds, params.source);
  const returnReason = params.reason?.trim() || autoReason;

  if (exceeded && params.cause !== UNSCHEDULED_CAUSE.TAB_CLOSE) {
    await maybeAlertAdminsForOpenAway({
      employeeUserId: params.employeeUserId,
      employeeName: params.employeeName,
      attendanceLogId: params.attendanceLogId,
      openSession: {
        id: openSession.id,
        breakStart: new Date(openSession.breakStart as Date),
        unscheduledCause: openSession.unscheduledCause
      },
      now: params.eventAt
    });
  }

  const addedMinutes = exceeded
    ? minutesBetween(new Date(openSession.breakStart as Date), params.eventAt)
    : 0;
  await db.transaction(async (tx) => {
    await tx
      .update(schema.breakSessions)
      .set({
        breakEnd: params.eventAt,
        returnReason
      })
      .where(eq(schema.breakSessions.id, openSession.id));

    if (addedMinutes <= 0) {
      await tx
        .update(schema.attendanceLogs)
        .set({
          status: "active",
          lastActivityAt: params.eventAt,
          lastActivitySource: params.source
        })
        .where(eq(schema.attendanceLogs.id, params.attendanceLogId));
      return;
    }

    if (params.cause === UNSCHEDULED_CAUSE.TAB_CLOSE) {
      await tx
        .update(schema.attendanceLogs)
        .set({
          status: "active",
          totalBreakMinutes: sql`${schema.attendanceLogs.totalBreakMinutes} + ${addedMinutes}`,
          unscheduledIdleMinutes: sql`${schema.attendanceLogs.unscheduledIdleMinutes} + ${addedMinutes}`,
          tabCloseMinutes: sql`${schema.attendanceLogs.tabCloseMinutes} + ${addedMinutes}`,
          lastActivityAt: params.eventAt,
          lastActivitySource: params.source
        })
        .where(eq(schema.attendanceLogs.id, params.attendanceLogId));
    } else if (params.cause === UNSCHEDULED_CAUSE.CURSOR_IDLE) {
      await tx
        .update(schema.attendanceLogs)
        .set({
          status: "active",
          totalBreakMinutes: sql`${schema.attendanceLogs.totalBreakMinutes} + ${addedMinutes}`,
          unscheduledIdleMinutes: sql`${schema.attendanceLogs.unscheduledIdleMinutes} + ${addedMinutes}`,
          cursorAwayMinutes: sql`${schema.attendanceLogs.cursorAwayMinutes} + ${addedMinutes}`,
          lastActivityAt: params.eventAt,
          lastActivitySource: params.source
        })
        .where(eq(schema.attendanceLogs.id, params.attendanceLogId));
    } else {
      await tx
        .update(schema.attendanceLogs)
        .set({
          status: "active",
          totalBreakMinutes: sql`${schema.attendanceLogs.totalBreakMinutes} + ${addedMinutes}`,
          unscheduledIdleMinutes: sql`${schema.attendanceLogs.unscheduledIdleMinutes} + ${addedMinutes}`,
          sleepMinutes: sql`${schema.attendanceLogs.sleepMinutes} + ${addedMinutes}`,
          lastActivityAt: params.eventAt,
          lastActivitySource: params.source
        })
        .where(eq(schema.attendanceLogs.id, params.attendanceLogId));
    }
  });

  if (params.cause === UNSCHEDULED_CAUSE.TAB_CLOSE) {
    await notifyAdminsTabBrowserReturned({
      employeeUserId: params.employeeUserId,
      employeeName: params.employeeName,
      awaySeconds,
      breakSessionId: openSession.id
    });
  }

  return { ok: true, awaySeconds, addedMinutes, autoReason: returnReason };
}

export async function checkOpenComplianceAwayAlerts(params: {
  employeeUserId: number;
  employeeName: string;
  attendanceLogId: number;
  now?: Date;
}) {
  const [openSession] = await db
    .select()
    .from(schema.breakSessions)
    .where(
      and(
        eq(schema.breakSessions.attendanceLogId, params.attendanceLogId),
        isNull(schema.breakSessions.breakEnd),
        eq(schema.breakSessions.breakType, "unscheduled")
      )
    )
    .limit(1);

  if (!openSession?.unscheduledCause) return;

  await maybeAlertAdminsForOpenAway({
    employeeUserId: params.employeeUserId,
    employeeName: params.employeeName,
    attendanceLogId: params.attendanceLogId,
    openSession: {
      id: openSession.id,
      breakStart: new Date(openSession.breakStart as Date),
      unscheduledCause: openSession.unscheduledCause
    },
    now: params.now
  });
}

export function normalizeComplianceAwayCause(
  value: unknown
): ComplianceAwayCause | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === UNSCHEDULED_CAUSE.TAB_CLOSE) return UNSCHEDULED_CAUSE.TAB_CLOSE;
  if (normalized === UNSCHEDULED_CAUSE.CURSOR_IDLE) return UNSCHEDULED_CAUSE.CURSOR_IDLE;
  if (normalized === UNSCHEDULED_CAUSE.SLEEP) return UNSCHEDULED_CAUSE.SLEEP;
  return null;
}

