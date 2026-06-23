import { NextResponse } from "next/server";
import { getLocalDateString } from "@/lib/attendance-date";
import { userHasOpenAttendanceShift } from "@/lib/attendance-live-log";
import {
  ATTENDANCE_WEEKEND_OFF_MESSAGE,
  isAttendanceWeekend
} from "@/lib/attendance-working-days";

/** Blocks new clock-in on company weekends. */
export function rejectAttendanceOnWeekend(): NextResponse | null {
  const today = getLocalDateString();
  if (isAttendanceWeekend(today)) {
    return NextResponse.json({ error: ATTENDANCE_WEEKEND_OFF_MESSAGE }, { status: 403 });
  }
  return null;
}

/** Allows finishing an overnight open shift that crosses into a weekend. */
export async function rejectAttendanceOnWeekendUnlessOpenShift(
  userId: number
): Promise<NextResponse | null> {
  const today = getLocalDateString();
  if (!isAttendanceWeekend(today)) return null;
  if (await userHasOpenAttendanceShift(userId)) return null;
  return NextResponse.json({ error: ATTENDANCE_WEEKEND_OFF_MESSAGE }, { status: 403 });
}
