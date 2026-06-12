import { eq } from "drizzle-orm";
import { schema } from "@asbatechs-crm/database";
import { db } from "@/lib/db";
import {
  formatOfficeTimeLabel,
  isValidOfficeTime
} from "@/lib/attendance-office-hours";
import { getAttendanceOfficeHours } from "@/lib/attendance-office-settings";

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

export async function getEmployeeScheduleSummary(userId: number): Promise<{
  userId: number;
  employeeExpectedCheckInTime: string | null;
  officeExpectedCheckInTime: string;
  effectiveExpectedCheckInTime: string;
  effectiveExpectedCheckInLabel: string;
  usesOfficeDefault: boolean;
}> {
  const office = await getAttendanceOfficeHours();
  const [user] = await db
    .select({ expectedCheckInTime: schema.users.expectedCheckInTime })
    .from(schema.users)
    .where(eq(schema.users.id, userId));

  const employeeExpectedCheckInTime = user?.expectedCheckInTime?.trim() ?? null;
  const usesOfficeDefault =
    !employeeExpectedCheckInTime || !isValidOfficeTime(employeeExpectedCheckInTime);
  const effectiveExpectedCheckInTime = usesOfficeDefault
    ? office.expectedCheckInTime
    : employeeExpectedCheckInTime;

  return {
    userId,
    employeeExpectedCheckInTime: usesOfficeDefault ? null : employeeExpectedCheckInTime,
    officeExpectedCheckInTime: office.expectedCheckInTime,
    effectiveExpectedCheckInTime,
    effectiveExpectedCheckInLabel: formatOfficeTimeLabel(effectiveExpectedCheckInTime),
    usesOfficeDefault
  };
}

export async function updateEmployeeExpectedCheckInTime(params: {
  userId: number;
  expectedCheckInTime: string | null;
}): Promise<{
  employeeExpectedCheckInTime: string | null;
  effectiveExpectedCheckInTime: string;
  effectiveExpectedCheckInLabel: string;
  usesOfficeDefault: boolean;
}> {
  const normalized =
    params.expectedCheckInTime == null ? null : params.expectedCheckInTime.trim();

  if (normalized && !isValidOfficeTime(normalized)) {
    throw new Error("Invalid time. Use HH:mm (24-hour format).");
  }

  await db
    .update(schema.users)
    .set({
      expectedCheckInTime: normalized,
      updatedAt: new Date()
    })
    .where(eq(schema.users.id, params.userId));

  const summary = await getEmployeeScheduleSummary(params.userId);
  return {
    employeeExpectedCheckInTime: summary.employeeExpectedCheckInTime,
    effectiveExpectedCheckInTime: summary.effectiveExpectedCheckInTime,
    effectiveExpectedCheckInLabel: summary.effectiveExpectedCheckInLabel,
    usesOfficeDefault: summary.usesOfficeDefault
  };
}
