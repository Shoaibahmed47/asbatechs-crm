import { and, asc, eq } from "drizzle-orm";

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
  totalHours: string | null;
  hasLog: boolean;
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
      totalHours: schema.attendanceLogs.totalHours
    })
    .from(schema.users)
    .leftJoin(schema.attendanceLogs, joinOn)
    .orderBy(asc(schema.users.name));

  return raw.map(mapRow);
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
    totalHours: r.totalHours != null ? String(r.totalHours) : null,
    hasLog: r.logId != null
  };
}
