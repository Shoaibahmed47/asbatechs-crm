import { NextResponse } from "next/server";
import { getLocalDateString } from "@/lib/attendance-date";
import { getEmployeeDayOffMessage, isEmployeeWorkingDayToday } from "@/lib/attendance-employee-working-day";

export async function rejectAttendanceIfNotWorkingDay(userId: number): Promise<NextResponse | null> {
  const today = getLocalDateString();
  const isWorking = await isEmployeeWorkingDayToday(userId);
  if (!isWorking) {
    const message = await getEmployeeDayOffMessage(userId, today);
    return NextResponse.json({ error: message }, { status: 403 });
  }
  return null;
}
