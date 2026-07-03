import "server-only";

import { and, eq, gte, lte } from "drizzle-orm";
import { schema } from "@asbatechs-crm/database";
import { db } from "@/lib/db";
import { getLocalDateString } from "@/lib/attendance-date";
import {
  addAttendanceCalendarDays,
  getAttendanceWeekday
} from "@/lib/attendance-working-days";
import type { EmployeePunctualityStats } from "@/lib/attendance-punctuality-shared";
import {
  enumerateEmployeeWorkingDaysInclusive,
  isEmployeeWorkingDay,
  previousEmployeeWorkingDay
} from "@/lib/attendance-employee-working-day";

export type { EmployeePunctualityStats };

function getWeekMonday(dateStr: string): string {
  const weekday = getAttendanceWeekday(dateStr);
  const daysSinceMonday = (weekday + 6) % 7;
  return addAttendanceCalendarDays(dateStr, -daysSinceMonday);
}

function isOnTimeLog(lateMinutes: number | null | undefined): boolean {
  return (lateMinutes ?? 0) <= 0;
}

type DayLog = {
  date: string;
  clockIn: Date | null;
  lateMinutes: number | null;
};

async function computeStreak(
  userId: number,
  logsByDate: Map<string, DayLog>,
  today: string
): Promise<{ currentStreak: number; streakIncludesToday: boolean; lateToday: boolean }> {
  let cursor = today;
  let guard = 0;
  while (!(await isEmployeeWorkingDay(userId, cursor)) && guard < 14) {
    cursor = addAttendanceCalendarDays(cursor, -1);
    guard += 1;
  }

  const todayLog = logsByDate.get(cursor);
  const lateToday = Boolean(todayLog?.clockIn && !isOnTimeLog(todayLog.lateMinutes));

  if (lateToday) {
    return { currentStreak: 0, streakIncludesToday: false, lateToday: true };
  }

  let streakIncludesToday = false;
  if (todayLog?.clockIn && isOnTimeLog(todayLog.lateMinutes)) {
    streakIncludesToday = true;
  } else {
    cursor = await previousEmployeeWorkingDay(userId, cursor);
  }

  let streak = 0;
  const maxLookback = 60;

  for (let i = 0; i < maxLookback; i += 1) {
    let skipGuard = 0;
    while (!(await isEmployeeWorkingDay(userId, cursor)) && skipGuard < 14) {
      cursor = addAttendanceCalendarDays(cursor, -1);
      skipGuard += 1;
    }

    const log = logsByDate.get(cursor);
    if (!log?.clockIn || !isOnTimeLog(log.lateMinutes)) {
      break;
    }

    streak += 1;
    cursor = await previousEmployeeWorkingDay(userId, cursor);
  }

  return { currentStreak: streak, streakIncludesToday, lateToday: false };
}

export async function getEmployeePunctualityStats(
  userId: number,
  today = getLocalDateString()
): Promise<EmployeePunctualityStats> {
  const weekStart = getWeekMonday(today);
  const streakLookbackStart = addAttendanceCalendarDays(today, -90);

  const rows = await db
    .select({
      date: schema.attendanceLogs.date,
      clockIn: schema.attendanceLogs.clockIn,
      lateMinutes: schema.attendanceLogs.lateMinutes
    })
    .from(schema.attendanceLogs)
    .where(
      and(
        eq(schema.attendanceLogs.userId, userId),
        gte(schema.attendanceLogs.date, streakLookbackStart as any),
        lte(schema.attendanceLogs.date, today as any)
      )
    );

  const logsByDate = new Map<string, DayLog>();
  for (const row of rows) {
    const dateKey = String(row.date);
    logsByDate.set(dateKey, {
      date: dateKey,
      clockIn: row.clockIn as Date | null,
      lateMinutes: row.lateMinutes
    });
  }

  let weekOnTimeDays = 0;
  let weekClockInDays = 0;

  const weekWorkingDays = await enumerateEmployeeWorkingDaysInclusive(userId, weekStart, today);
  for (const date of weekWorkingDays) {
    const log = logsByDate.get(date);
    if (!log?.clockIn) continue;
    weekClockInDays += 1;
    if (isOnTimeLog(log.lateMinutes)) {
      weekOnTimeDays += 1;
    }
  }

  const { currentStreak, streakIncludesToday, lateToday } = await computeStreak(
    userId,
    logsByDate,
    today
  );

  return {
    weekOnTimeDays,
    weekClockInDays,
    currentStreak,
    streakIncludesToday,
    lateToday
  };
}
