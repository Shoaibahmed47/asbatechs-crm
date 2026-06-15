import { NextRequest, NextResponse } from "next/server";
import { resolveStaffAuth } from "@/lib/staff-auth-request";
import { getEmployeePunctualityStats } from "@/lib/attendance-punctuality";
import { buildPunctualityStreakLabel } from "@/lib/attendance-punctuality-shared";

export async function GET(req: NextRequest) {
  const payload = await resolveStaffAuth(req);

  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stats = await getEmployeePunctualityStats(payload.userId);

  return NextResponse.json({
    stats,
    streakLabel: buildPunctualityStreakLabel(stats)
  });
}
