import { eq } from "drizzle-orm";
import { schema } from "@asbatechs-crm/database";
import { db } from "@/lib/db";
import {
  formatOfficeTimeLabel,
  isValidOfficeTime,
  officeShiftEndsNextDay
} from "@/lib/attendance-office-hours";
import { getAttendanceOfficeHours } from "@/lib/attendance-office-settings";

function normalizeOptionalTime(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed;
}

export async function getExpectedCheckInTimeForEmployee(userId: number): Promise<string> {
  const [user] = await db
    .select({ expectedCheckInTime: schema.users.expectedCheckInTime })
    .from(schema.users)
    .where(eq(schema.users.id, userId));

  const override = user?.expectedCheckInTime?.trim() ?? "";
  if (override && isValidOfficeTime(override)) {
    return override;
  }

  const office = await getAttendanceOfficeHours();
  return office.expectedCheckInTime;
}

export async function getExpectedShiftEndTimeForEmployee(userId: number): Promise<string> {
  const [user] = await db
    .select({ expectedShiftEndTime: schema.users.expectedShiftEndTime })
    .from(schema.users)
    .where(eq(schema.users.id, userId));

  const override = user?.expectedShiftEndTime?.trim() ?? "";
  if (override && isValidOfficeTime(override)) {
    return override;
  }

  const office = await getAttendanceOfficeHours();
  return office.shiftEndTime;
}

export type EmployeeScheduleSummary = {
  userId: number;
  employeeExpectedCheckInTime: string | null;
  employeeExpectedShiftEndTime: string | null;
  officeExpectedCheckInTime: string;
  officeShiftEndTime: string;
  effectiveExpectedCheckInTime: string;
  effectiveExpectedCheckInLabel: string;
  effectiveExpectedShiftEndTime: string;
  effectiveExpectedShiftEndLabel: string;
  shiftEndsNextDay: boolean;
  usesOfficeDefault: boolean;
};

export async function getEmployeeScheduleSummary(userId: number): Promise<EmployeeScheduleSummary> {
  const office = await getAttendanceOfficeHours();
  const [user] = await db
    .select({
      expectedCheckInTime: schema.users.expectedCheckInTime,
      expectedShiftEndTime: schema.users.expectedShiftEndTime
    })
    .from(schema.users)
    .where(eq(schema.users.id, userId));

  const employeeExpectedCheckInTime = normalizeOptionalTime(user?.expectedCheckInTime);
  const employeeExpectedShiftEndTime = normalizeOptionalTime(user?.expectedShiftEndTime);

  const usesCheckInOfficeDefault =
    !employeeExpectedCheckInTime || !isValidOfficeTime(employeeExpectedCheckInTime);
  const usesShiftEndOfficeDefault =
    !employeeExpectedShiftEndTime || !isValidOfficeTime(employeeExpectedShiftEndTime);

  const effectiveExpectedCheckInTime = usesCheckInOfficeDefault
    ? office.expectedCheckInTime
    : employeeExpectedCheckInTime;
  const effectiveExpectedShiftEndTime = usesShiftEndOfficeDefault
    ? office.shiftEndTime
    : employeeExpectedShiftEndTime;

  return {
    userId,
    employeeExpectedCheckInTime: usesCheckInOfficeDefault ? null : employeeExpectedCheckInTime,
    employeeExpectedShiftEndTime: usesShiftEndOfficeDefault ? null : employeeExpectedShiftEndTime,
    officeExpectedCheckInTime: office.expectedCheckInTime,
    officeShiftEndTime: office.shiftEndTime,
    effectiveExpectedCheckInTime,
    effectiveExpectedCheckInLabel: formatOfficeTimeLabel(effectiveExpectedCheckInTime),
    effectiveExpectedShiftEndTime,
    effectiveExpectedShiftEndLabel: formatOfficeTimeLabel(effectiveExpectedShiftEndTime),
    shiftEndsNextDay: officeShiftEndsNextDay(
      effectiveExpectedCheckInTime,
      effectiveExpectedShiftEndTime
    ),
    usesOfficeDefault: usesCheckInOfficeDefault && usesShiftEndOfficeDefault
  };
}

export async function updateEmployeeSchedule(params: {
  userId: number;
  expectedCheckInTime: string | null;
  expectedShiftEndTime: string | null;
}): Promise<
  Pick<
    EmployeeScheduleSummary,
    | "employeeExpectedCheckInTime"
    | "employeeExpectedShiftEndTime"
    | "effectiveExpectedCheckInTime"
    | "effectiveExpectedCheckInLabel"
    | "effectiveExpectedShiftEndTime"
    | "effectiveExpectedShiftEndLabel"
    | "shiftEndsNextDay"
    | "usesOfficeDefault"
  >
> {
  const checkInNormalized = normalizeOptionalTime(params.expectedCheckInTime);
  const shiftEndNormalized = normalizeOptionalTime(params.expectedShiftEndTime);

  if (checkInNormalized && !isValidOfficeTime(checkInNormalized)) {
    throw new Error("Invalid check-in time. Use HH:mm (24-hour format).");
  }
  if (shiftEndNormalized && !isValidOfficeTime(shiftEndNormalized)) {
    throw new Error("Invalid check-out time. Use HH:mm (24-hour format).");
  }

  await db
    .update(schema.users)
    .set({
      expectedCheckInTime: checkInNormalized,
      expectedShiftEndTime: shiftEndNormalized,
      updatedAt: new Date()
    })
    .where(eq(schema.users.id, params.userId));

  const summary = await getEmployeeScheduleSummary(params.userId);
  return {
    employeeExpectedCheckInTime: summary.employeeExpectedCheckInTime,
    employeeExpectedShiftEndTime: summary.employeeExpectedShiftEndTime,
    effectiveExpectedCheckInTime: summary.effectiveExpectedCheckInTime,
    effectiveExpectedCheckInLabel: summary.effectiveExpectedCheckInLabel,
    effectiveExpectedShiftEndTime: summary.effectiveExpectedShiftEndTime,
    effectiveExpectedShiftEndLabel: summary.effectiveExpectedShiftEndLabel,
    shiftEndsNextDay: summary.shiftEndsNextDay,
    usesOfficeDefault: summary.usesOfficeDefault
  };
}

/** @deprecated Use updateEmployeeSchedule */
export async function updateEmployeeExpectedCheckInTime(params: {
  userId: number;
  expectedCheckInTime: string | null;
}) {
  return updateEmployeeSchedule({
    userId: params.userId,
    expectedCheckInTime: params.expectedCheckInTime,
    expectedShiftEndTime: null
  });
}
