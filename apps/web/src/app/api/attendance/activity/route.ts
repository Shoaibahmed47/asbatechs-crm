import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { getLocalDateString } from "@/lib/attendance-date";
import { UNSCHEDULED_CAUSE, type UnscheduledCause } from "@/lib/attendance-reason";

type ActivityEvent =
  | "activity"
  | "idle_warning"
  | "idle_start"
  | "idle_end"
  | "lock"
  | "unlock";

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
    normalized === "unlock"
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

export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value ?? getBearerToken(req);
  const payload = token ? await verifyAuthToken(token) : null;

  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const eventType = normalizeEvent(body.event);
  const source = normalizeSource(body.source);
  const reason = normalizeReason(body.reason);
  const eventAt = normalizeObservedAt(body.observedAt);
  const userId = payload.userId;
  const today = getLocalDateString(eventAt);

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
      await db.insert(schema.activityLogs).values({
        userId,
        action: "agent_heartbeat",
        entityType: "attendance_agent",
        entityId: 0
      });
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
  const unscheduledCause: UnscheduledCause =
    eventType === "lock" ? UNSCHEDULED_CAUSE.SLEEP : UNSCHEDULED_CAUSE.IDLE;

  // Inactivity threshold crossed: classify as unscheduled idle break if there is no open break.
  if (eventType === "idle_start" || eventType === "lock") {
    if (hasOpenManualBreak) {
      return NextResponse.json({ ok: true, status: "break", classified: false });
    }

    if (!hasOpenUnscheduledBreak) {
      await db.transaction(async (tx) => {
        await tx.insert(schema.breakSessions).values({
          attendanceLogId: log.id,
          breakStart: eventAt,
          breakType: "unscheduled",
          unscheduledCause
        });
        await tx
          .update(schema.attendanceLogs)
          .set({
            status: "idle",
            idleEventsCount:
              unscheduledCause === UNSCHEDULED_CAUSE.IDLE
                ? sql`${schema.attendanceLogs.idleEventsCount} + 1`
                : schema.attendanceLogs.idleEventsCount,
            sleepEventsCount:
              unscheduledCause === UNSCHEDULED_CAUSE.SLEEP
                ? sql`${schema.attendanceLogs.sleepEventsCount} + 1`
                : schema.attendanceLogs.sleepEventsCount
          })
          .where(eq(schema.attendanceLogs.id, log.id));
      });
      return NextResponse.json({ ok: true, status: "idle", classified: true });
    }

    await db
      .update(schema.attendanceLogs)
      .set({ status: "idle" })
      .where(eq(schema.attendanceLogs.id, log.id));

    if (
      eventType === "lock" &&
      openSession?.unscheduledCause !== UNSCHEDULED_CAUSE.SLEEP
    ) {
      await db
        .update(schema.breakSessions)
        .set({ unscheduledCause: UNSCHEDULED_CAUSE.SLEEP })
        .where(eq(schema.breakSessions.id, openSession!.id));
    }

    return NextResponse.json({ ok: true, status: "idle", classified: false });
  }

  if (eventType === "idle_warning") {
    // UI-only advisory event; no persistent transition needed.
    return NextResponse.json({ ok: true, warned: true });
  }

  // Activity resumed: close unscheduled idle break if one is open.
  if (hasOpenUnscheduledBreak && openSession) {
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
