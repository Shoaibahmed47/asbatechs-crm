import { NextResponse } from "next/server";

import { ATTENDANCE_AWAY_POLICY, ATTENDANCE_ACTIVITY_PING_SECONDS } from "@/lib/attendance-policy";

/** Read-only attendance thresholds for employee browser/agent clients. */
export async function GET() {
  return NextResponse.json({
    away: ATTENDANCE_AWAY_POLICY,
    activityPingSeconds: ATTENDANCE_ACTIVITY_PING_SECONDS
  });
}
