import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { getLocalDateString } from "@/lib/attendance-date";
import {
  checkOpenComplianceAwayAlerts,
  endComplianceAway,
  normalizeComplianceAwayCause,
  startComplianceAway,
  type ComplianceAwayCause
} from "@/lib/attendance-away-compliance";
import { ATTENDANCE_CURSOR_IDLE_ENABLED } from "@/lib/attendance-policy";
import { UNSCHEDULED_CAUSE, type UnscheduledCause } from "@/lib/attendance-reason";
import { rejectAttendanceOnWeekend } from "@/lib/attendance-weekend-guard";

type ActivityEvent =
  | "activity"
  | "idle_warning"
  | "idle_start"
  | "idle_end"
  | "lock"
  | "unlock"
  | "away_start"
  | "away_end";

type SourceType = "browser" | "agent";

function getBearerToken(req: NextRequest): string | null {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(" ");
  if (!scheme || !token) return null;
  if (scheme.toLowerCase() !== "bearer") return null;
  return token.trim() || null;
}

function normalizeEvent(value: unknown): ActivityEvent {
  if (typeof value !== "string") return "activity";
  const normalized = value.trim().toLowerCase();
  if (
    normalized === "activity" ||
    normalized === "idle_warning" ||
    normalized === "idle_start" ||
    normalized === "idle_end" ||
    normalized === "lock" ||
    normalized === "unlock" ||
    normalized === "away_start" ||
    normalized === "away_end"
  ) {
    return normalized;
  }
  return "activity";
}

function normalizeSource(value: unknown): SourceType {
  return value === "agent" ? "agent" : "browser";
}

function normalizeObservedAt(value: unknown): Date {
  if (typeof value === "string") {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

function normalizeReason(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 240);
}

function isComplianceCause(value: string | null | undefined): value is ComplianceAwayCause {
  return (
    value === UNSCHEDULED_CAUSE.TAB_CLOSE ||
    value === UNSCHEDULED_CAUSE.CURSOR_IDLE ||
    value === UNSCHEDULED_CAUSE.SLEEP
  );
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value ?? getBearerToken(req);
  const payload = token ? await verifyAuthToken(token) : null;

  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const weekendBlocked = rejectAttendanceOnWeekend();
  if (weekendBlocked) return weekendBlocked;

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const eventType = normalizeEvent(body.event);
  const source = normalizeSource(body.source);
  const reason = normalizeReason(body.reason);
  const awayCause =
    normalizeComplianceAwayCause(body.awayCause) ??
    (eventType === "lock" ? UNSCHEDULED_CAUSE.SLEEP : null);
  const eventAt = normalizeObservedAt(body.observedAt);
  const userId = payload.userId;
  const today = getLocalDateString(eventAt);

  const [employee] = await db
    .select({ name: schema.users.name })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  const employeeName = employee?.name ?? "Employee";

  const [log] = await db
    .select()
    .from(schema.attendanceLogs)
    .where(
      and(
        eq(schema.attendanceLogs.userId, userId),
        eq(schema.attendanceLogs.date, today as any)
      )
    );

  // Health-check mode: when shift is not open, keep lightweight heartbeat for agent verify flow.
  if ((!log || !log.clockIn || log.clockOut) && source === "agent") {
    const [latestHeartbeat] = await db
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
      .limit(1);

    const isImmediateRecoveryEvent =
      eventType === "unlock" || eventType === "idle_end" || eventType === "activity";
    const shouldInsertHeartbeat =
      isImmediateRecoveryEvent ||
      !latestHeartbeat ||
      Date.now() - new Date(latestHeartbeat.createdAt as Date).getTime() >= 90 * 1000;

    if (shouldInsertHeartbeat) {
      try {
        await db.insert(schema.activityLogs).values({
          userId,
          action: "agent_heartbeat",
          entityType: "attendance_agent",
          entityId: 0
        });
      } catch (heartbeatError) {
        console.warn("Agent heartbeat log skipped:", heartbeatError);
      }
    }
  }

  if (!log || !log.clockIn || log.clockOut) {
    return NextResponse.json({
      ignored: true,
      reason: "No open shift for the given date."
    });
  }

  const [openSession] = await db
    .select()
    .from(schema.breakSessions)
    .where(
      and(
        eq(schema.breakSessions.attendanceLogId, log.id),
        isNull(schema.breakSessions.breakEnd)
      )
    );

  const hasOpenManualBreak = Boolean(openSession && openSession.breakType === "manual");
  const hasOpenUnscheduledBreak = Boolean(
    openSession && openSession.breakType === "unscheduled"
  );

  if (
    !ATTENDANCE_CURSOR_IDLE_ENABLED &&
    awayCause === UNSCHEDULED_CAUSE.CURSOR_IDLE &&
    (eventType === "away_start" || eventType === "away_end")
  ) {
    return NextResponse.json({
      ok: true,
      ignored: true,
      reason: "cursor_idle_tracking_disabled"
    });
  }

  if (eventType === "away_start" && awayCause) {
    const started = await startComplianceAway({
      attendanceLogId: log.id,
      cause: awayCause,
      eventAt,
      hasOpenManualBreak,
      employeeUserId: userId,
      employeeName
    });
    return NextResponse.json({ ok: true, status: "idle", awayCause, started: started.started });
  }

  if ((eventType === "away_end" || eventType === "unlock") && awayCause) {
    const endCause =
      eventType === "unlock" ? UNSCHEDULED_CAUSE.SLEEP : awayCause;
    const ended = await endComplianceAway({
      attendanceLogId: log.id,
      employeeUserId: userId,
      employeeName,
      cause: endCause,
      eventAt,
      reason,
      source
    });
    return NextResponse.json({
      ok: true,
      resumed: true,
      awaySeconds: ended.awaySeconds,
      addedMinutes: ended.addedMinutes,
      autoReason: ended.autoReason
    });
  }

  if (eventType === "lock" && awayCause === UNSCHEDULED_CAUSE.SLEEP) {
    if (hasOpenManualBreak) {
      return NextResponse.json({ ok: true, status: "break", classified: false });
    }
    const started = await startComplianceAway({
      attendanceLogId: log.id,
      cause: UNSCHEDULED_CAUSE.SLEEP,
      eventAt,
      hasOpenManualBreak
    });
    await checkOpenComplianceAwayAlerts({
      employeeUserId: userId,
      employeeName,
      attendanceLogId: log.id,
      now: eventAt
    });
    return NextResponse.json({ ok: true, status: "idle", classified: started.started });
  }

  if (
    eventType === "idle_end" &&
    hasOpenUnscheduledBreak &&
    openSession?.unscheduledCause === UNSCHEDULED_CAUSE.IDLE
  ) {
    const addedMinutes = Math.max(
      0,
      Math.floor((eventAt.getTime() - new Date(openSession.breakStart as Date).getTime()) / 60000)
    );

    await db.transaction(async (tx) => {
      await tx
        .update(schema.breakSessions)
        .set({
          breakEnd: eventAt,
          returnReason: reason ?? openSession.returnReason
        })
        .where(eq(schema.breakSessions.id, openSession.id));

      await tx
        .update(schema.attendanceLogs)
        .set({
          status: "active",
          totalBreakMinutes: sql`${schema.attendanceLogs.totalBreakMinutes} + ${addedMinutes}`,
          unscheduledIdleMinutes: sql`${schema.attendanceLogs.unscheduledIdleMinutes} + ${addedMinutes}`,
          lastActivityAt: eventAt,
          lastActivitySource: source
        })
        .where(eq(schema.attendanceLogs.id, log.id));
    });

    return NextResponse.json({ ok: true, resumed: true, addedMinutes });
  }

  if (eventType === "idle_start" || eventType === "idle_warning") {
    return NextResponse.json({ ok: true, ignored: true, legacy: true });
  }

  if (hasOpenUnscheduledBreak && openSession) {
    if (isComplianceCause(openSession.unscheduledCause)) {
      await checkOpenComplianceAwayAlerts({
        employeeUserId: userId,
        employeeName,
        attendanceLogId: log.id,
        now: eventAt
      });
      return NextResponse.json({
        ok: true,
        status: "idle",
        openAwayCause: openSession.unscheduledCause,
        needsAwayEnd: true
      });
    }

    const addedMinutes = Math.max(
      0,
      Math.floor((eventAt.getTime() - new Date(openSession.breakStart as Date).getTime()) / 60000)
    );

    await db.transaction(async (tx) => {
      await tx
        .update(schema.breakSessions)
        .set({
          breakEnd: eventAt,
          returnReason: reason ?? openSession.returnReason
        })
        .where(eq(schema.breakSessions.id, openSession.id));

      await tx
        .update(schema.attendanceLogs)
        .set({
          status: "active",
          totalBreakMinutes: sql`${schema.attendanceLogs.totalBreakMinutes} + ${addedMinutes}`,
          unscheduledIdleMinutes: sql`${schema.attendanceLogs.unscheduledIdleMinutes} + ${addedMinutes}`,
          sleepMinutes:
            openSession.unscheduledCause === UNSCHEDULED_CAUSE.SLEEP
              ? sql`${schema.attendanceLogs.sleepMinutes} + ${addedMinutes}`
              : schema.attendanceLogs.sleepMinutes,
          lastActivityAt: eventAt,
          lastActivitySource: source
        })
        .where(eq(schema.attendanceLogs.id, log.id));
    });

    return NextResponse.json({ ok: true, resumed: true, addedMinutes });
  }

  await checkOpenComplianceAwayAlerts({
    employeeUserId: userId,
    employeeName,
    attendanceLogId: log.id,
    now: eventAt
  });

  const nextStatus = hasOpenManualBreak ? "break" : "active";
  await db
    .update(schema.attendanceLogs)
    .set({
      status: nextStatus,
      lastActivityAt: eventAt,
      lastActivitySource: source
    })
    .where(eq(schema.attendanceLogs.id, log.id));

  return NextResponse.json({ ok: true, status: nextStatus });
}
