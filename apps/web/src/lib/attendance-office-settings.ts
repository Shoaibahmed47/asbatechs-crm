import { eq } from "drizzle-orm";
import { schema } from "@asbatechs-crm/database";
import { db } from "@/lib/db";
import {
  DEFAULT_LATE_GRACE_MINUTES,
  DEFAULT_OFFICE_CHECK_IN_TIME,
  DEFAULT_OFFICE_SHIFT_END_TIME,
  isValidOfficeTime,
  type AttendanceOfficeHours
} from "@/lib/attendance-office-hours";

function normalizeGraceMinutes(value: number | null | undefined): number {
  if (value == null || Number.isNaN(value)) return DEFAULT_LATE_GRACE_MINUTES;
  return Math.min(120, Math.max(0, Math.floor(value)));
}

export async function getAttendanceOfficeHours(): Promise<AttendanceOfficeHours> {
  const [row] = await db
    .select({
      expectedCheckInTime: schema.attendanceOfficeSettings.expectedCheckInTime,
      shiftEndTime: schema.attendanceOfficeSettings.shiftEndTime,
      lateGraceMinutes: schema.attendanceOfficeSettings.lateGraceMinutes,
      updatedAt: schema.attendanceOfficeSettings.updatedAt
    })
    .from(schema.attendanceOfficeSettings)
    .where(eq(schema.attendanceOfficeSettings.id, 1));

  if (!row) {
    return {
      expectedCheckInTime: DEFAULT_OFFICE_CHECK_IN_TIME,
      shiftEndTime: DEFAULT_OFFICE_SHIFT_END_TIME,
      lateGraceMinutes: DEFAULT_LATE_GRACE_MINUTES,
      updatedAt: null
    };
  }

  return {
    expectedCheckInTime: row.expectedCheckInTime,
    shiftEndTime: row.shiftEndTime,
    lateGraceMinutes: normalizeGraceMinutes(row.lateGraceMinutes),
    updatedAt: row.updatedAt ? new Date(row.updatedAt as Date).toISOString() : null
  };
}

export async function updateAttendanceOfficeHours(params: {
  expectedCheckInTime: string;
  shiftEndTime: string;
  lateGraceMinutes: number;
  updatedByUserId: number;
}): Promise<AttendanceOfficeHours> {
  const expectedCheckInTime = params.expectedCheckInTime.trim();
  const shiftEndTime = params.shiftEndTime.trim();
  const lateGraceMinutes = normalizeGraceMinutes(params.lateGraceMinutes);

  if (!isValidOfficeTime(expectedCheckInTime) || !isValidOfficeTime(shiftEndTime)) {
    throw new Error("Invalid office time. Use HH:mm format (24-hour).");
  }

  const now = new Date();
  await db
    .insert(schema.attendanceOfficeSettings)
    .values({
      id: 1,
      expectedCheckInTime,
      shiftEndTime,
      lateGraceMinutes,
      updatedAt: now,
      updatedByUserId: params.updatedByUserId
    })
    .onConflictDoUpdate({
      target: schema.attendanceOfficeSettings.id,
      set: {
        expectedCheckInTime,
        shiftEndTime,
        lateGraceMinutes,
        updatedAt: now,
        updatedByUserId: params.updatedByUserId
      }
    });

  return {
    expectedCheckInTime,
    shiftEndTime,
    lateGraceMinutes,
    updatedAt: now.toISOString()
  };
}
