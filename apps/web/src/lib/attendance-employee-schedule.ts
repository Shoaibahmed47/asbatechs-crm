import { and, eq, isNotNull, lte } from "drizzle-orm";
import { schema } from "@asbatechs-crm/database";
import { db } from "@/lib/db";
import {
  formatAttendanceDateLabel,
  getLocalDateString,
  isValidAttendanceDateString
} from "@/lib/attendance-date";
import {
  formatOfficeTimeLabel,
  isValidOfficeTime,
  officeShiftEndsNextDay,
  type AttendanceOfficeHours
} from "@/lib/attendance-office-hours";
import { getAttendanceOfficeHours } from "@/lib/attendance-office-settings";

function normalizeOptionalTime(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed;
}

function normalizeDateOnly(value: string | Date | null | undefined): string | null {
  if (value == null) return null;
  const text = String(value).slice(0, 10);
  return isValidAttendanceDateString(text) ? text : null;
}

export type UserScheduleFields = {
  expectedCheckInTime: string | null;
  expectedShiftEndTime: string | null;
  pendingExpectedCheckInTime: string | null;
  pendingExpectedShiftEndTime: string | null;
  scheduleEffectiveFrom: string | Date | null;
};

export type ResolvedEmployeeSchedule = {
  employeeExpectedCheckInTime: string | null;
  employeeExpectedShiftEndTime: string | null;
  effectiveExpectedCheckInTime: string;
  effectiveExpectedShiftEndTime: string;
  effectiveExpectedCheckInLabel: string;
  effectiveExpectedShiftEndLabel: string;
  shiftEndsNextDay: boolean;
  usesOfficeDefault: boolean;
  scheduleSource: "active" | "pending";
};

export function resolveEmployeeScheduleForDate(
  user: UserScheduleFields,
  office: AttendanceOfficeHours,
  asOfDate: string
): ResolvedEmployeeSchedule {
  const effectiveFrom = normalizeDateOnly(user.scheduleEffectiveFrom);
  const usePending = Boolean(effectiveFrom && asOfDate >= effectiveFrom);

  const employeeExpectedCheckInTime = normalizeOptionalTime(
    usePending ? user.pendingExpectedCheckInTime : user.expectedCheckInTime
  );
  const employeeExpectedShiftEndTime = normalizeOptionalTime(
    usePending ? user.pendingExpectedShiftEndTime : user.expectedShiftEndTime
  );

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
    employeeExpectedCheckInTime: usesCheckInOfficeDefault ? null : employeeExpectedCheckInTime,
    employeeExpectedShiftEndTime: usesShiftEndOfficeDefault ? null : employeeExpectedShiftEndTime,
    effectiveExpectedCheckInTime,
    effectiveExpectedShiftEndTime,
    effectiveExpectedCheckInLabel: formatOfficeTimeLabel(effectiveExpectedCheckInTime),
    effectiveExpectedShiftEndLabel: formatOfficeTimeLabel(effectiveExpectedShiftEndTime),
    shiftEndsNextDay: officeShiftEndsNextDay(
      effectiveExpectedCheckInTime,
      effectiveExpectedShiftEndTime
    ),
    usesOfficeDefault: usesCheckInOfficeDefault && usesShiftEndOfficeDefault,
    scheduleSource: usePending ? "pending" : "active"
  };
}

const userScheduleSelect = {
  expectedCheckInTime: schema.users.expectedCheckInTime,
  expectedShiftEndTime: schema.users.expectedShiftEndTime,
  pendingExpectedCheckInTime: schema.users.pendingExpectedCheckInTime,
  pendingExpectedShiftEndTime: schema.users.pendingExpectedShiftEndTime,
  scheduleEffectiveFrom: schema.users.scheduleEffectiveFrom
};

async function loadUserScheduleFields(userId: number): Promise<UserScheduleFields | null> {
  const [user] = await db
    .select(userScheduleSelect)
    .from(schema.users)
    .where(eq(schema.users.id, userId));
  return user ?? null;
}

/** Promote pending schedules whose effective date has arrived (today or earlier). */
export async function promoteAllDueEmployeeSchedules(): Promise<number> {
  const today = getLocalDateString();
  const dueUsers = await db
    .select({
      id: schema.users.id,
      pendingExpectedCheckInTime: schema.users.pendingExpectedCheckInTime,
      pendingExpectedShiftEndTime: schema.users.pendingExpectedShiftEndTime
    })
    .from(schema.users)
    .where(
      and(
        isNotNull(schema.users.scheduleEffectiveFrom),
        lte(schema.users.scheduleEffectiveFrom, today as any)
      )
    );

  for (const user of dueUsers) {
    await db
      .update(schema.users)
      .set({
        expectedCheckInTime: normalizeOptionalTime(user.pendingExpectedCheckInTime),
        expectedShiftEndTime: normalizeOptionalTime(user.pendingExpectedShiftEndTime),
        pendingExpectedCheckInTime: null,
        pendingExpectedShiftEndTime: null,
        scheduleEffectiveFrom: null,
        updatedAt: new Date()
      })
      .where(eq(schema.users.id, user.id));
  }

  return dueUsers.length;
}

export async function getExpectedCheckInTimeForEmployee(
  userId: number,
  asOfDate?: string
): Promise<string> {
  const date = asOfDate ?? getLocalDateString();
  await promoteAllDueEmployeeSchedules();

  const office = await getAttendanceOfficeHours();
  const user = await loadUserScheduleFields(userId);
  if (!user) {
    return office.expectedCheckInTime;
  }

  return resolveEmployeeScheduleForDate(user, office, date).effectiveExpectedCheckInTime;
}

export async function getExpectedShiftEndTimeForEmployee(
  userId: number,
  asOfDate?: string
): Promise<string> {
  const date = asOfDate ?? getLocalDateString();
  await promoteAllDueEmployeeSchedules();

  const office = await getAttendanceOfficeHours();
  const user = await loadUserScheduleFields(userId);
  if (!user) {
    return office.shiftEndTime;
  }

  return resolveEmployeeScheduleForDate(user, office, date).effectiveExpectedShiftEndTime;
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
  hasPendingSchedule: boolean;
  pendingEffectiveFrom: string | null;
  pendingEffectiveFromLabel: string | null;
  pendingEmployeeExpectedCheckInTime: string | null;
  pendingEmployeeExpectedShiftEndTime: string | null;
  pendingEffectiveExpectedCheckInLabel: string | null;
  pendingEffectiveExpectedShiftEndLabel: string | null;
  pendingShiftEndsNextDay: boolean;
  pendingUsesOfficeDefault: boolean;
};

export async function getEmployeeScheduleSummary(userId: number): Promise<EmployeeScheduleSummary> {
  await promoteAllDueEmployeeSchedules();

  const office = await getAttendanceOfficeHours();
  const user = await loadUserScheduleFields(userId);
  const today = getLocalDateString();

  const active = resolveEmployeeScheduleForDate(
    user ?? {
      expectedCheckInTime: null,
      expectedShiftEndTime: null,
      pendingExpectedCheckInTime: null,
      pendingExpectedShiftEndTime: null,
      scheduleEffectiveFrom: null
    },
    office,
    today
  );

  const pendingEffectiveFrom = normalizeDateOnly(user?.scheduleEffectiveFrom ?? null);
  const hasPendingSchedule = Boolean(pendingEffectiveFrom && pendingEffectiveFrom > today);

  let pendingSummary: ResolvedEmployeeSchedule | null = null;
  if (hasPendingSchedule && user) {
    pendingSummary = resolveEmployeeScheduleForDate(user, office, pendingEffectiveFrom!);
  }

  return {
    userId,
    employeeExpectedCheckInTime: active.employeeExpectedCheckInTime,
    employeeExpectedShiftEndTime: active.employeeExpectedShiftEndTime,
    officeExpectedCheckInTime: office.expectedCheckInTime,
    officeShiftEndTime: office.shiftEndTime,
    effectiveExpectedCheckInTime: active.effectiveExpectedCheckInTime,
    effectiveExpectedCheckInLabel: active.effectiveExpectedCheckInLabel,
    effectiveExpectedShiftEndTime: active.effectiveExpectedShiftEndTime,
    effectiveExpectedShiftEndLabel: active.effectiveExpectedShiftEndLabel,
    shiftEndsNextDay: active.shiftEndsNextDay,
    usesOfficeDefault: active.usesOfficeDefault,
    hasPendingSchedule,
    pendingEffectiveFrom: hasPendingSchedule ? pendingEffectiveFrom : null,
    pendingEffectiveFromLabel: hasPendingSchedule
      ? formatAttendanceDateLabel(pendingEffectiveFrom!)
      : null,
    pendingEmployeeExpectedCheckInTime: pendingSummary?.employeeExpectedCheckInTime ?? null,
    pendingEmployeeExpectedShiftEndTime: pendingSummary?.employeeExpectedShiftEndTime ?? null,
    pendingEffectiveExpectedCheckInLabel: pendingSummary?.effectiveExpectedCheckInLabel ?? null,
    pendingEffectiveExpectedShiftEndLabel: pendingSummary?.effectiveExpectedShiftEndLabel ?? null,
    pendingShiftEndsNextDay: pendingSummary?.shiftEndsNextDay ?? false,
    pendingUsesOfficeDefault: pendingSummary?.usesOfficeDefault ?? false
  };
}

export async function updateEmployeeSchedule(params: {
  userId: number;
  expectedCheckInTime: string | null;
  expectedShiftEndTime: string | null;
  effectiveFrom?: string | null;
}): Promise<EmployeeScheduleSummary> {
  const checkInNormalized = normalizeOptionalTime(params.expectedCheckInTime);
  const shiftEndNormalized = normalizeOptionalTime(params.expectedShiftEndTime);

  if (checkInNormalized && !isValidOfficeTime(checkInNormalized)) {
    throw new Error("Invalid check-in time. Use HH:mm (24-hour format).");
  }
  if (shiftEndNormalized && !isValidOfficeTime(shiftEndNormalized)) {
    throw new Error("Invalid check-out time. Use HH:mm (24-hour format).");
  }

  const today = getLocalDateString();
  const effectiveFromRaw = params.effectiveFrom?.trim() || today;
  if (!isValidAttendanceDateString(effectiveFromRaw)) {
    throw new Error("Invalid effective date. Use YYYY-MM-DD.");
  }
  if (effectiveFromRaw < today) {
    throw new Error("Effective date cannot be in the past.");
  }

  if (effectiveFromRaw <= today) {
    await db
      .update(schema.users)
      .set({
        expectedCheckInTime: checkInNormalized,
        expectedShiftEndTime: shiftEndNormalized,
        pendingExpectedCheckInTime: null,
        pendingExpectedShiftEndTime: null,
        scheduleEffectiveFrom: null,
        updatedAt: new Date()
      })
      .where(eq(schema.users.id, params.userId));
  } else {
    await db
      .update(schema.users)
      .set({
        pendingExpectedCheckInTime: checkInNormalized,
        pendingExpectedShiftEndTime: shiftEndNormalized,
        scheduleEffectiveFrom: effectiveFromRaw as any,
        updatedAt: new Date()
      })
      .where(eq(schema.users.id, params.userId));
  }

  return getEmployeeScheduleSummary(params.userId);
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
