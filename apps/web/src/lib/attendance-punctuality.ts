import "server-only";

import { and, eq, gte, lte } from "drizzle-orm";
import { schema } from "@asbatechs-crm/database";
import { db } from "@/lib/db";
import { getLocalDateString } from "@/lib/attendance-date";
import {
  addAttendanceCalendarDays,
  getAttendanceWeekday,
  isAttendanceWeekend
} from "@/lib/attendance-working-days";
import type { EmployeePunctualityStats } from "@/lib/attendance-punctuality-shared";

export type { EmployeePunctualityStats };

function getWeekMonday(dateStr: string): string {
  const weekday = getAttendanceWeekday(dateStr);
  const daysSinceMonday = (weekday + 6) % 7;
  return addAttendanceCalendarDays(dateStr, -daysSinceMonday);
}

function previousWorkingDay(dateStr: string): string {
  let cursor = addAttendanceCalendarDays(dateStr, -1);
  while (isAttendanceWeekend(cursor)) {
    cursor = addAttendanceCalendarDays(cursor, -1);
  }
  return cursor;
}

function isOnTimeLog(lateMinutes: number | null | undefined): boolean {
  return (lateMinutes ?? 0) <= 0;
}

type DayLog = {
  date: string;
  clockIn: Date | null;
  lateMinutes: number | null;
};

function computeStreak(
  logsByDate: Map<string, DayLog>,
  today: string
): { currentStreak: number; streakIncludesToday: boolean; lateToday: boolean } {
  let cursor = today;
  while (isAttendanceWeekend(cursor)) {
    cursor = addAttendanceCalendarDays(cursor, -1);
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
    cursor = previousWorkingDay(cursor);
  }

  let streak = 0;
  const maxLookback = 60;

  for (let i = 0; i < maxLookback; i += 1) {
    while (isAttendanceWeekend(cursor)) {
      cursor = addAttendanceCalendarDays(cursor, -1);
    }

    const log = logsByDate.get(cursor);
    if (!log?.clockIn || !isOnTimeLog(log.lateMinutes)) {
      break;
    }

    streak += 1;
    cursor = previousWorkingDay(cursor);
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

  for (const date of enumerateWorkingDaysInclusive(weekStart, today)) {
    const log = logsByDate.get(date);
    if (!log?.clockIn) continue;
    weekClockInDays += 1;
    if (isOnTimeLog(log.lateMinutes)) {
      weekOnTimeDays += 1;
    }
  }

  const { currentStreak, streakIncludesToday, lateToday } = computeStreak(logsByDate, today);

  return {
    weekOnTimeDays,
    weekClockInDays,
    currentStreak,
    streakIncludesToday,
    lateToday
  };
}

function enumerateWorkingDaysInclusive(from: string, to: string): string[] {
  const dates: string[] = [];
  let cursor = from;
  while (cursor <= to) {
    if (!isAttendanceWeekend(cursor)) {
      dates.push(cursor);
    }
    cursor = addAttendanceCalendarDays(cursor, 1);
  }
  return dates;
}
