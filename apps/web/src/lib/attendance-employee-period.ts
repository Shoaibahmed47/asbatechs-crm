import { and, asc, eq, gte, lte } from "drizzle-orm";

import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { enumerateLocalDates, getLocalDateString } from "@/lib/attendance-date";
import { addAttendanceCalendarDays } from "@/lib/attendance-working-days";
import { computeDayTotalsFromSessions } from "@/lib/attendance-shift-minutes";
import { resolveOpenShiftBoundsForEmployee } from "@/lib/attendance-shift-window";
import { MAX_ATTENDANCE_PERIOD_DAYS } from "@/lib/attendance-policy";

export { MAX_ATTENDANCE_PERIOD_DAYS };

export type AttendanceEmployeeDaySummary = {
  date: string;
  hasLog: boolean;
  clockIn: string | null;
  clockOut: string | null;
  totalWorkMinutes: number;
  totalBreakMinutes: number;
  unscheduledIdleMinutes: number;
  sleepMinutes: number;
  totalHours: string | null;
  status: string;
  openShift: boolean;
};

export type AttendanceEmployeePeriodSummary = {
  from: string;
  to: string;
  dayCount: number;
  daysWithAttendance: number;
  daysAbsent: number;
  totals: {
    totalWorkMinutes: number;
    totalBreakMinutes: number;
    unscheduledIdleMinutes: number;
    sleepMinutes: number;
  };
  dailyRows: AttendanceEmployeeDaySummary[];
};

function normalizeRange(from: string, to: string): { from: string; to: string } {
  return from <= to ? { from, to } : { from: to, to: from };
}

export function clampAttendancePeriodRange(
  from: string,
  to: string
): { from: string; to: string; truncated: boolean } {
  const range = normalizeRange(from, to);
  const days = enumerateLocalDates(range.from, range.to);
  if (days.length <= MAX_ATTENDANCE_PERIOD_DAYS) {
    return { ...range, truncated: false };
  }
  const trimmedFrom = addAttendanceCalendarDays(range.to, -(MAX_ATTENDANCE_PERIOD_DAYS - 1));
  return { from: trimmedFrom, to: range.to, truncated: true };
}

export async function getAttendanceEmployeePeriodSummary(params: {
  userId: number;
  from: string;
  to: string;
}): Promise<AttendanceEmployeePeriodSummary> {
  const range = clampAttendancePeriodRange(params.from, params.to);
  const calendarDays = enumerateLocalDates(range.from, range.to);
  const today = getLocalDateString();

  const logs = await db
    .select()
    .from(schema.attendanceLogs)
    .where(
      and(
        eq(schema.attendanceLogs.userId, params.userId),
        gte(schema.attendanceLogs.date, range.from as any),
        lte(schema.attendanceLogs.date, range.to as any)
      )
    )
    .orderBy(asc(schema.attendanceLogs.date));

  const logByDate = new Map(logs.map((row) => [String(row.date), row]));

  const dailyRows: AttendanceEmployeeDaySummary[] = [];

  for (const day of calendarDays) {
    const log = logByDate.get(day);
    if (!log || !log.clockIn) {
      dailyRows.push({
        date: day,
        hasLog: false,
        clockIn: null,
        clockOut: null,
        totalWorkMinutes: 0,
        totalBreakMinutes: 0,
        unscheduledIdleMinutes: 0,
        sleepMinutes: 0,
        totalHours: null,
        status: "absent",
        openShift: false
      });
      continue;
    }

    const openShift = Boolean(log.clockIn && !log.clockOut);
    let totalWorkMinutes = log.totalWorkMinutes ?? 0;
    let totalBreakMinutes = log.totalBreakMinutes ?? 0;
    let unscheduledIdleMinutes = log.unscheduledIdleMinutes ?? 0;
    let sleepMinutes = log.sleepMinutes ?? 0;
    let totalHours = log.totalHours != null ? String(log.totalHours) : null;

    if (openShift && day === today) {
      const breakRows = await db
        .select()
        .from(schema.breakSessions)
        .where(eq(schema.breakSessions.attendanceLogId, log.id));

      const now = new Date();
      const bounds = await resolveOpenShiftBoundsForEmployee({
        userId: params.userId,
        logDate: day,
        clockIn: new Date(log.clockIn as Date),
        clockOut: null,
        now
      });

      const totals = computeDayTotalsFromSessions({
        clockIn: new Date(log.clockIn as Date),
        clockOut: null,
        now,
        calculationStart: bounds.start,
        calculationEnd: bounds.end,
        breakSessions: breakRows.map((row) => ({
          breakStart: new Date(row.breakStart as Date).toISOString(),
          breakEnd: row.breakEnd ? new Date(row.breakEnd as Date).toISOString() : null,
          breakType: row.breakType,
          unscheduledCause: row.unscheduledCause
        }))
      });

      totalWorkMinutes = totals.workMinutes;
      totalBreakMinutes = totals.breakMinutes;
      unscheduledIdleMinutes = totals.inactiveMinutes + totals.sleepMinutes;
      sleepMinutes = totals.sleepMinutes;
      totalHours = totals.workMinutes > 0 ? (totals.workMinutes / 60).toFixed(2) : null;
    }

    dailyRows.push({
      date: day,
      hasLog: true,
      clockIn: log.clockIn ? new Date(log.clockIn as Date).toISOString() : null,
      clockOut: log.clockOut ? new Date(log.clockOut as Date).toISOString() : null,
      totalWorkMinutes,
      totalBreakMinutes,
      unscheduledIdleMinutes,
      sleepMinutes,
      totalHours,
      status: (log.status ?? "offline").toLowerCase(),
      openShift
    });
  }

  const daysWithAttendance = dailyRows.filter((row) => row.hasLog).length;
  const totals = dailyRows.reduce(
    (acc, row) => ({
      totalWorkMinutes: acc.totalWorkMinutes + row.totalWorkMinutes,
      totalBreakMinutes: acc.totalBreakMinutes + row.totalBreakMinutes,
      unscheduledIdleMinutes: acc.unscheduledIdleMinutes + row.unscheduledIdleMinutes,
      sleepMinutes: acc.sleepMinutes + row.sleepMinutes
    }),
    {
      totalWorkMinutes: 0,
      totalBreakMinutes: 0,
      unscheduledIdleMinutes: 0,
      sleepMinutes: 0
    }
  );

  return {
    from: range.from,
    to: range.to,
    dayCount: calendarDays.length,
    daysWithAttendance,
    daysAbsent: calendarDays.length - daysWithAttendance,
    totals,
    dailyRows
  };
}
