import { and, desc, eq, isNotNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { schema } from "@asbatechs-crm/database";
import { COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { getLocalDateString } from "@/lib/attendance-date";
import { resolveAppUrl } from "@/lib/request-origin";
import { classifyAgentState } from "@/lib/attendance-agent-health-state";

function getBearerToken(req: NextRequest): string | null {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(" ");
  if (!scheme || !token) return null;
  if (scheme.toLowerCase() !== "bearer") return null;
  return token.trim() || null;
}

function toIso(value: Date | null | undefined): string | null {
  return value ? new Date(value).toISOString() : null;
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value ?? getBearerToken(req);
  const payload = token ? await verifyAuthToken(token) : null;
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = getLocalDateString();
  const appUrl = resolveAppUrl(req);

  const [todayLog] = await db
    .select()
    .from(schema.attendanceLogs)
    .where(
      and(
        eq(schema.attendanceLogs.userId, payload.userId),
        eq(schema.attendanceLogs.date, today as any)
      )
    );

  const [latestAgentLog] = await db
    .select()
    .from(schema.attendanceLogs)
    .where(
      and(
        eq(schema.attendanceLogs.userId, payload.userId),
        eq(schema.attendanceLogs.lastActivitySource, "agent"),
        isNotNull(schema.attendanceLogs.lastActivityAt)
      )
    )
    .orderBy(desc(schema.attendanceLogs.lastActivityAt))
    .limit(1);

  const [latestAgentHeartbeat] = await db
    .select({ createdAt: schema.activityLogs.createdAt })
    .from(schema.activityLogs)
    .where(
      and(
        eq(schema.activityLogs.userId, payload.userId),
        eq(schema.activityLogs.entityType, "attendance_agent"),
        eq(schema.activityLogs.action, "agent_heartbeat"),
        eq(schema.activityLogs.entityId, 0)
      )
    )
    .orderBy(desc(schema.activityLogs.createdAt))
    .limit(1);

  const [latestSetupMarker] = await db
    .select({ createdAt: schema.activityLogs.createdAt })
    .from(schema.activityLogs)
    .where(
      and(
        eq(schema.activityLogs.userId, payload.userId),
        eq(schema.activityLogs.entityType, "attendance_agent"),
        eq(schema.activityLogs.action, "agent_setup_prepared"),
        eq(schema.activityLogs.entityId, 0)
      )
    )
    .orderBy(desc(schema.activityLogs.createdAt))
    .limit(1);

  const openShift = Boolean(todayLog?.clockIn && !todayLog?.clockOut);
  const latestLogActivityAt = latestAgentLog?.lastActivityAt
    ? new Date(latestAgentLog.lastActivityAt as Date)
    : null;
  const latestHeartbeatAt = latestAgentHeartbeat?.createdAt
    ? new Date(latestAgentHeartbeat.createdAt as Date)
    : null;
  const latestSetupAt = latestSetupMarker?.createdAt
    ? new Date(latestSetupMarker.createdAt as Date)
    : null;
  const latestActualAgentAt =
    latestLogActivityAt && latestHeartbeatAt
      ? latestLogActivityAt.getTime() >= latestHeartbeatAt.getTime()
        ? latestLogActivityAt
        : latestHeartbeatAt
      : latestLogActivityAt ?? latestHeartbeatAt ?? null;
  const lastActivityAt = latestActualAgentAt ?? latestSetupAt ?? null;
  const lastActivitySource = latestActualAgentAt
    ? "agent"
    : latestSetupAt
      ? "setup"
      : null;
  const actualClassification = classifyAgentState(latestActualAgentAt);
  const setupAgeSeconds = latestSetupAt
    ? Math.max(0, Math.floor((Date.now() - latestSetupAt.getTime()) / 1000))
    : null;
  const state = latestActualAgentAt
    ? actualClassification.state
    : latestSetupAt
      ? "installed"
      : "not_installed";
  const lastActivityAgeSeconds = latestActualAgentAt
    ? actualClassification.ageSeconds
    : setupAgeSeconds;

  const statusLabel =
    state === "running"
      ? "Running"
      : state === "installed"
        ? "Installed"
        : state === "stale"
          ? "No recent activity"
          : "Not installed";

  const recommendedAction =
    state === "not_installed"
      ? "Install the desktop agent once from Attendance page."
      : state === "stale" && openShift
        ? "Verify scheduled task and restart agent."
        : state === "installed" && openShift
          ? "Click Verify Agent. If still not running, use Reconfigure."
          : "No action needed.";

  return NextResponse.json({
    state,
    statusLabel,
    openShift,
    lastActivityAt: toIso(lastActivityAt),
    lastActivitySource,
    lastActivityAgeSeconds,
    recommendedAction,
    appUrl
  });
}
