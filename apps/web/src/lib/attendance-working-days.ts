import { ATTENDANCE_TIME_ZONE, getLocalDateString } from "@/lib/attendance-date";
import { ATTENDANCE_LATE_EXPLANATION_TEST_MODE } from "@/lib/attendance-policy";

const WEEKDAY_SHORT: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6
};

/** Company weekend — no attendance / clock-in (Saturday & Sunday, Asia/Karachi). */
export const ATTENDANCE_WEEKEND_OFF_ENABLED = true;

export function addAttendanceCalendarDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const cursor = new Date(Date.UTC(y, m - 1, d));
  cursor.setUTCDate(cursor.getUTCDate() + days);
  const yy = cursor.getUTCFullYear();
  const mm = String(cursor.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(cursor.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function getAttendanceWeekday(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  const label = new Intl.DateTimeFormat("en-US", {
    timeZone: ATTENDANCE_TIME_ZONE,
    weekday: "short"
  }).format(new Date(Date.UTC(y, m - 1, d, 12, 0, 0)));
  return WEEKDAY_SHORT[label] ?? 0;
}

export function isAttendanceWeekend(dateStr: string): boolean {
  if (!ATTENDANCE_WEEKEND_OFF_ENABLED) return false;
  const day = getAttendanceWeekday(dateStr);
  return day === 0 || day === 6;
}

export function isAttendanceWorkingDay(dateStr: string): boolean {
  return !isAttendanceWeekend(dateStr);
}

export function isAttendanceWeekendToday(): boolean {
  return isAttendanceWeekend(getLocalDateString());
}

/**
 * First working day when late/early explanation popup may appear (skips Sat/Sun).
 * Example: Friday late → Monday (not Saturday).
 */
export function getExplanationPromptDueDate(logDate: string): string {
  let due = addAttendanceCalendarDays(logDate, 1);
  while (isAttendanceWeekend(due)) {
    due = addAttendanceCalendarDays(due, 1);
  }
  return due;
}

export function isExplanationPromptDue(logDate: string, today = getLocalDateString()): boolean {
  if (ATTENDANCE_LATE_EXPLANATION_TEST_MODE) {
    return logDate <= today;
  }
  if (logDate >= today) return false;
  return today >= getExplanationPromptDueDate(logDate);
}

export const ATTENDANCE_WEEKEND_OFF_MESSAGE =
  "Saturday and Sunday are off. Attendance is not available on weekends.";
