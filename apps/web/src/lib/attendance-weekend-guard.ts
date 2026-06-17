import { NextResponse } from "next/server";
import { getLocalDateString } from "@/lib/attendance-date";
import {
  ATTENDANCE_WEEKEND_OFF_MESSAGE,
  isAttendanceWeekend
} from "@/lib/attendance-working-days";

export function rejectAttendanceOnWeekend(): NextResponse | null {
  const today = getLocalDateString();
  if (isAttendanceWeekend(today)) {
    return NextResponse.json({ error: ATTENDANCE_WEEKEND_OFF_MESSAGE }, { status: 403 });
  }
  return null;
}
//updateddd
