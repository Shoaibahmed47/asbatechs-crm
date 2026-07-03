import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { resolveStaffAuth } from "@/lib/staff-auth-request";
import { getLocalDateString } from "@/lib/attendance-date";
import { getExpectedScheduleForEmployeeOnDate } from "@/lib/attendance-employee-schedule";
import { getEmployeeDayOffMessage } from "@/lib/attendance-employee-working-day";

export async function GET(req: NextRequest) {
  const payload = await resolveStaffAuth(req);
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = getLocalDateString();
  const resolved = await getExpectedScheduleForEmployeeOnDate(payload.userId, today);
  const dayOffMessage = resolved.isWorkingDay
    ? null
    : await getEmployeeDayOffMessage(payload.userId, today);

  return NextResponse.json({
    date: today,
    isWorkingDay: resolved.isWorkingDay,
    dayOffMessage,
    schedule: {
      checkInTime: resolved.effectiveExpectedCheckInTime,
      checkInLabel: resolved.effectiveExpectedCheckInLabel,
      shiftEndTime: resolved.effectiveExpectedShiftEndTime,
      shiftEndLabel: resolved.effectiveExpectedShiftEndLabel,
      shiftEndsNextDay: resolved.shiftEndsNextDay,
      usesWeeklySchedule: resolved.usesWeeklySchedule
    }
  });
}
