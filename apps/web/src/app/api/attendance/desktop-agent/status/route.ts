import { and, desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { schema } from "@asbatechs-crm/database";
import { COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { getLocalDateString } from "@/lib/attendance-date";
import { findOpenAttendanceLog } from "@/lib/attendance-live-log";
import { resolveAppUrl } from "@/lib/request-origin";
import {
  pickLatestAgentSignalOnDate,
  resolveAgentHealthState
} from "@/lib/attendance-agent-health-state";
import { labelForDisplayAgentState } from "@/lib/attendance-agent-health-display";

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

  const [[todayLog], openShiftLog, [latestAgentHeartbeat], [latestSetupMarker]] = await Promise.all([
    db
      .select()
      .from(schema.attendanceLogs)
      .where(
        and(
          eq(schema.attendanceLogs.userId, payload.userId),
          eq(schema.attendanceLogs.date, today as any)
        )
      ),
    findOpenAttendanceLog(payload.userId),
    db
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
      .limit(1),
    db
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
      .limit(1)
  ]);

  const openShift = Boolean(
    openShiftLog?.clockIn && !openShiftLog?.clockOut
  );
  const activeLog = openShiftLog ?? todayLog;
  const latestLogActivityAt =
    (activeLog?.lastActivitySource === "agent" ||
      activeLog?.lastActivitySource === "electron") &&
    activeLog.lastActivityAt
      ? new Date(activeLog.lastActivityAt as Date)
      : null;
  const heartbeatDates = latestAgentHeartbeat?.createdAt
    ? [new Date(latestAgentHeartbeat.createdAt as Date)]
    : [];
  const latestSetupAt = latestSetupMarker?.createdAt
    ? new Date(latestSetupMarker.createdAt as Date)
    : null;
  const latestActualAgentAt = pickLatestAgentSignalOnDate(today, [
    latestLogActivityAt,
    ...heartbeatDates
  ]);
  const { state, ageSeconds: lastActivityAgeSeconds } = resolveAgentHealthState({
    lastAgentAtOnDate: latestActualAgentAt,
    lastSetupAt: latestSetupAt,
    openShift
  });
  const lastActivityAt = latestActualAgentAt ?? latestSetupAt ?? null;
  const lastActivitySource = latestActualAgentAt
    ? activeLog?.lastActivitySource === "electron"
      ? "electron"
      : "agent"
    : latestSetupAt
      ? "setup"
      : null;

  const statusLabel = labelForDisplayAgentState(state);

  const recommendedAction =
    state === "not_installed"
      ? "Install the AsbaTechs CRM desktop app (recommended) or the legacy desktop agent from Attendance."
      : state === "running"
        ? "No action needed."
        : openShift
          ? "Click Verify Agent if you need to confirm monitoring is running."
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
