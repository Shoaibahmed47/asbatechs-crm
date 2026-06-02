import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";

import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";

export type AttendanceDailyRow = {
  userId: number;
  userName: string;
  userEmail: string;
  departmentId: number | null;
  clockIn: string | null;
  clockOut: string | null;
  totalWorkMinutes: number | null;
  totalBreakMinutes: number | null;
  sleepMinutes: number | null;
  totalHours: string | null;
  hasLog: boolean;
};

export type AttendanceRangeRow = {
  userId: number;
  userName: string;
  userEmail: string;
  departmentId: number | null;
  presentDays: number;
  absentDays: number;
  totalWorkMinutes: number;
  totalBreakMinutes: number;
  totalHours: string;
};

/** Per-user attendance for one calendar day (managers: same department only). */
export async function getAttendanceDailyReport(
  date: string,
  scope: { role: "admin" | "manager"; departmentId: number | null }
): Promise<AttendanceDailyRow[]> {
  const joinOn = and(
    eq(schema.attendanceLogs.userId, schema.users.id),
    eq(schema.attendanceLogs.date, date as any)
  );

  if (scope.role === "manager") {
    if (scope.departmentId == null) return [];
    const raw = await db
      .select({
        userId: schema.users.id,
        userName: schema.users.name,
        userEmail: schema.users.email,
        departmentId: schema.users.departmentId,
        logId: schema.attendanceLogs.id,
        clockIn: schema.attendanceLogs.clockIn,
        clockOut: schema.attendanceLogs.clockOut,
        totalWorkMinutes: schema.attendanceLogs.totalWorkMinutes,
        totalBreakMinutes: schema.attendanceLogs.totalBreakMinutes,
        sleepMinutes: schema.attendanceLogs.sleepMinutes,
        totalHours: schema.attendanceLogs.totalHours
      })
      .from(schema.users)
      .leftJoin(schema.attendanceLogs, joinOn)
      .where(eq(schema.users.departmentId, scope.departmentId))
      .orderBy(asc(schema.users.name));

    return raw.map(mapRow);
  }

  const raw = await db
    .select({
      userId: schema.users.id,
      userName: schema.users.name,
      userEmail: schema.users.email,
      departmentId: schema.users.departmentId,
      logId: schema.attendanceLogs.id,
      clockIn: schema.attendanceLogs.clockIn,
      clockOut: schema.attendanceLogs.clockOut,
      totalWorkMinutes: schema.attendanceLogs.totalWorkMinutes,
      totalBreakMinutes: schema.attendanceLogs.totalBreakMinutes,
      sleepMinutes: schema.attendanceLogs.sleepMinutes,
      totalHours: schema.attendanceLogs.totalHours
    })
    .from(schema.users)
    .leftJoin(schema.attendanceLogs, joinOn)
    .orderBy(asc(schema.users.name));

  return raw.map(mapRow);
}

/** Per-user attendance summary for an inclusive date range. */
export async function getAttendanceRangeReport(
  fromDate: string,
  toDate: string,
  scope: { role: "admin" | "manager"; departmentId: number | null }
): Promise<AttendanceRangeRow[]> {
  const usersQuery = db
    .select({
      userId: schema.users.id,
      userName: schema.users.name,
      userEmail: schema.users.email,
      departmentId: schema.users.departmentId
    })
    .from(schema.users)
    .$dynamic();

  const scopedUsers =
    scope.role === "manager" && scope.departmentId != null
      ? await usersQuery
          .where(eq(schema.users.departmentId, scope.departmentId))
          .orderBy(asc(schema.users.name))
      : scope.role === "manager" && scope.departmentId == null
        ? []
        : await usersQuery.orderBy(asc(schema.users.name));

  if (scopedUsers.length === 0) return [];

  const userIds = scopedUsers.map((u) => u.userId);
  const logs = await db
    .select({
      userId: schema.attendanceLogs.userId,
      clockIn: schema.attendanceLogs.clockIn,
      totalWorkMinutes: schema.attendanceLogs.totalWorkMinutes,
      totalBreakMinutes: schema.attendanceLogs.totalBreakMinutes
    })
    .from(schema.attendanceLogs)
    .where(
      and(
        inArray(schema.attendanceLogs.userId, userIds),
        gte(schema.attendanceLogs.date, fromDate as any),
        lte(schema.attendanceLogs.date, toDate as any)
      )
    );

  const dayCount = daysInclusive(fromDate, toDate);
  const agg = new Map<
    number,
    { presentDays: number; totalWorkMinutes: number; totalBreakMinutes: number }
  >();
  for (const log of logs) {
    const current = agg.get(log.userId) ?? {
      presentDays: 0,
      totalWorkMinutes: 0,
      totalBreakMinutes: 0
    };
    current.presentDays += log.clockIn ? 1 : 0;
    current.totalWorkMinutes += log.totalWorkMinutes ?? 0;
    current.totalBreakMinutes += log.totalBreakMinutes ?? 0;
    agg.set(log.userId, current);
  }

  return scopedUsers.map((user) => {
    const userAgg = agg.get(user.userId) ?? {
      presentDays: 0,
      totalWorkMinutes: 0,
      totalBreakMinutes: 0
    };
    const absentDays = Math.max(dayCount - userAgg.presentDays, 0);
    const totalHours = (userAgg.totalWorkMinutes / 60).toFixed(2);
    return {
      userId: user.userId,
      userName: user.userName,
      userEmail: user.userEmail,
      departmentId: user.departmentId,
      presentDays: userAgg.presentDays,
      absentDays,
      totalWorkMinutes: userAgg.totalWorkMinutes,
      totalBreakMinutes: userAgg.totalBreakMinutes,
      totalHours
    };
  });
}

function mapRow(r: {
  userId: number;
  userName: string;
  userEmail: string;
  departmentId: number | null;
  logId: number | null;
  clockIn: Date | null;
  clockOut: Date | null;
  totalWorkMinutes: number | null;
  totalBreakMinutes: number | null;
  sleepMinutes: number | null;
  totalHours: string | null;
}): AttendanceDailyRow {
  return {
    userId: r.userId,
    userName: r.userName,
    userEmail: r.userEmail,
    departmentId: r.departmentId,
    clockIn: r.clockIn ? new Date(r.clockIn as Date).toISOString() : null,
    clockOut: r.clockOut ? new Date(r.clockOut as Date).toISOString() : null,
    totalWorkMinutes: r.totalWorkMinutes,
    totalBreakMinutes: r.totalBreakMinutes,
    sleepMinutes: r.sleepMinutes,
    totalHours: r.totalHours != null ? String(r.totalHours) : null,
    hasLog: r.logId != null
  };
}

function daysInclusive(fromDate: string, toDate: string): number {
  const start = new Date(`${fromDate}T00:00:00`);
  const end = new Date(`${toDate}T00:00:00`);
  const diff = end.getTime() - start.getTime();
  if (Number.isNaN(diff) || diff < 0) return 1;
  return Math.floor(diff / 86400000) + 1;
}
