import { NextRequest, NextResponse } from "next/server";
import { autoClockOutDueOpenShifts } from "@/lib/attendance-auto-clock-out";

function isAuthorizedCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;

  const authHeader = req.headers.get("authorization");
  if (authHeader === `Bearer ${secret}`) return true;

  return req.headers.get("x-cron-secret") === secret;
}

/** Vercel cron (or manual trigger) — auto clock-out employees past shift end. */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await autoClockOutDueOpenShifts();
    return NextResponse.json({
      ok: true,
      closedCount: result.closedCount,
      closedLogIds: result.closedLogIds
    });
  } catch (error) {
    console.error("[cron/attendance-auto-clock-out]", error);
    return NextResponse.json({ error: "Auto clock-out failed." }, { status: 500 });
  }
}
