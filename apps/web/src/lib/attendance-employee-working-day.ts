import "server-only";

import { getLocalDateString } from "@/lib/attendance-date";
import {
  getExpectedScheduleForEmployeeOnDate,
  promoteAllDueEmployeeSchedules
} from "@/lib/attendance-employee-schedule";
import {
  addAttendanceCalendarDays,
  ATTENDANCE_WEEKEND_OFF_MESSAGE,
  isAttendanceWeekend
} from "@/lib/attendance-working-days";
import { WEEKLY_SCHEDULE_DAY_LABELS, weekdayKeyFromDate } from "@/lib/attendance-weekly-schedule";

export async function isEmployeeWorkingDay(userId: number, date: string): Promise<boolean> {
  const resolved = await getExpectedScheduleForEmployeeOnDate(userId, date);
  return resolved.isWorkingDay;
}

export async function getEmployeeDayOffMessage(userId: number, date: string): Promise<string> {
  const resolved = await getExpectedScheduleForEmployeeOnDate(userId, date);
  if (resolved.isWorkingDay) {
    return "";
  }
  if (resolved.usesWeeklySchedule) {
    const dayLabel = WEEKLY_SCHEDULE_DAY_LABELS[weekdayKeyFromDate(date)];
    return `${dayLabel} is off on your schedule. Attendance is not available today.`;
  }
  if (isAttendanceWeekend(date)) {
    return ATTENDANCE_WEEKEND_OFF_MESSAGE;
  }
  return "Today is not a working day for you.";
}

export async function isEmployeeWorkingDayToday(userId: number): Promise<boolean> {
  return isEmployeeWorkingDay(userId, getLocalDateString());
}

export async function getExplanationPromptDueDateForEmployee(
  userId: number,
  logDate: string
): Promise<string> {
  let due = addAttendanceCalendarDays(logDate, 1);
  const maxDays = 14;
  for (let i = 0; i < maxDays; i += 1) {
    if (await isEmployeeWorkingDay(userId, due)) {
      return due;
    }
    due = addAttendanceCalendarDays(due, 1);
  }
  return due;
}

export async function isExplanationPromptDueForEmployee(
  userId: number,
  logDate: string,
  today = getLocalDateString()
): Promise<boolean> {
  if (logDate >= today) return false;
  const dueDate = await getExplanationPromptDueDateForEmployee(userId, logDate);
  return today >= dueDate;
}

export async function enumerateEmployeeWorkingDaysInclusive(
  userId: number,
  from: string,
  to: string
): Promise<string[]> {
  await promoteAllDueEmployeeSchedules();
  const dates: string[] = [];
  let cursor = from;
  while (cursor <= to) {
    if (await isEmployeeWorkingDay(userId, cursor)) {
      dates.push(cursor);
    }
    cursor = addAttendanceCalendarDays(cursor, 1);
  }
  return dates;
}

export async function previousEmployeeWorkingDay(
  userId: number,
  dateStr: string
): Promise<string> {
  let cursor = addAttendanceCalendarDays(dateStr, -1);
  const maxDays = 14;
  for (let i = 0; i < maxDays; i += 1) {
    if (await isEmployeeWorkingDay(userId, cursor)) {
      return cursor;
    }
    cursor = addAttendanceCalendarDays(cursor, -1);
  }
  return cursor;
}
