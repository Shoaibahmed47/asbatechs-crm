import { and, eq, isNotNull, lte } from "drizzle-orm";
import { schema, type EmployeeWeeklySchedule } from "@asbatechs-crm/database";
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
import { isAttendanceWeekend } from "@/lib/attendance-working-days";
import {
  createDefaultWeeklySchedule,
  getWeeklyDaySchedule,
  isWeeklyDayWorking,
  normalizeWeeklySchedule,
  validateWeeklySchedule
} from "@/lib/attendance-weekly-schedule";

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
  weeklyScheduleEnabled: boolean;
  weeklySchedule: EmployeeWeeklySchedule | null;
  pendingWeeklySchedule: EmployeeWeeklySchedule | null;
};

export type ResolvedEmployeeSchedule = {
  isWorkingDay: boolean;
  usesWeeklySchedule: boolean;
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

const emptyUserScheduleFields: UserScheduleFields = {
  expectedCheckInTime: null,
  expectedShiftEndTime: null,
  pendingExpectedCheckInTime: null,
  pendingExpectedShiftEndTime: null,
  scheduleEffectiveFrom: null,
  weeklyScheduleEnabled: false,
  weeklySchedule: null,
  pendingWeeklySchedule: null
};

function resolveWeeklyScheduleForDate(
  user: UserScheduleFields,
  asOfDate: string
): EmployeeWeeklySchedule | null {
  if (!user.weeklyScheduleEnabled) return null;
  const effectiveFrom = normalizeDateOnly(user.scheduleEffectiveFrom);
  const usePending = Boolean(effectiveFrom && asOfDate >= effectiveFrom && user.pendingWeeklySchedule);
  if (usePending && user.pendingWeeklySchedule) {
    return user.pendingWeeklySchedule;
  }
  return user.weeklySchedule;
}

function buildNonWorkingDaySchedule(
  scheduleSource: "active" | "pending",
  usesWeeklySchedule: boolean
): ResolvedEmployeeSchedule {
  return {
    isWorkingDay: false,
    usesWeeklySchedule,
    employeeExpectedCheckInTime: null,
    employeeExpectedShiftEndTime: null,
    effectiveExpectedCheckInTime: "00:00",
    effectiveExpectedShiftEndTime: "00:00",
    effectiveExpectedCheckInLabel: "—",
    effectiveExpectedShiftEndLabel: "—",
    shiftEndsNextDay: false,
    usesOfficeDefault: false,
    scheduleSource
  };
}

export function resolveEmployeeScheduleForDate(
  user: UserScheduleFields,
  office: AttendanceOfficeHours,
  asOfDate: string
): ResolvedEmployeeSchedule {
  const effectiveFrom = normalizeDateOnly(user.scheduleEffectiveFrom);
  const usePending = Boolean(effectiveFrom && asOfDate >= effectiveFrom);
  const scheduleSource: "active" | "pending" = usePending ? "pending" : "active";

  const weeklySchedule = resolveWeeklyScheduleForDate(user, asOfDate);
  if (user.weeklyScheduleEnabled && weeklySchedule) {
    const daySchedule = getWeeklyDaySchedule(weeklySchedule, asOfDate);
    if (!daySchedule?.isWorking) {
      return buildNonWorkingDaySchedule(scheduleSource, true);
    }

    const employeeExpectedCheckInTime = normalizeOptionalTime(daySchedule.checkInTime);
    const employeeExpectedShiftEndTime = normalizeOptionalTime(daySchedule.shiftEndTime);

    const legacyCheckIn = normalizeOptionalTime(
      usePending ? user.pendingExpectedCheckInTime : user.expectedCheckInTime
    );
    const legacyShiftEnd = normalizeOptionalTime(
      usePending ? user.pendingExpectedShiftEndTime : user.expectedShiftEndTime
    );

    const usesCheckInOfficeDefault =
      !employeeExpectedCheckInTime ||
      !isValidOfficeTime(employeeExpectedCheckInTime);
    const usesShiftEndOfficeDefault =
      !employeeExpectedShiftEndTime ||
      !isValidOfficeTime(employeeExpectedShiftEndTime);

    const effectiveExpectedCheckInTime = usesCheckInOfficeDefault
      ? legacyCheckIn && isValidOfficeTime(legacyCheckIn)
        ? legacyCheckIn
        : office.expectedCheckInTime
      : employeeExpectedCheckInTime;
    const effectiveExpectedShiftEndTime = usesShiftEndOfficeDefault
      ? legacyShiftEnd && isValidOfficeTime(legacyShiftEnd)
        ? legacyShiftEnd
        : office.shiftEndTime
      : employeeExpectedShiftEndTime;

    return {
      isWorkingDay: true,
      usesWeeklySchedule: true,
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
      scheduleSource
    };
  }

  if (isAttendanceWeekend(asOfDate)) {
    return buildNonWorkingDaySchedule(scheduleSource, false);
  }

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
    isWorkingDay: true,
    usesWeeklySchedule: false,
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
    scheduleSource
  };
}

const userScheduleSelect = {
  expectedCheckInTime: schema.users.expectedCheckInTime,
  expectedShiftEndTime: schema.users.expectedShiftEndTime,
  pendingExpectedCheckInTime: schema.users.pendingExpectedCheckInTime,
  pendingExpectedShiftEndTime: schema.users.pendingExpectedShiftEndTime,
  scheduleEffectiveFrom: schema.users.scheduleEffectiveFrom,
  weeklyScheduleEnabled: schema.users.weeklyScheduleEnabled,
  weeklySchedule: schema.users.weeklySchedule,
  pendingWeeklySchedule: schema.users.pendingWeeklySchedule
};

async function loadUserScheduleFields(userId: number): Promise<UserScheduleFields | null> {
  const [user] = await db
    .select(userScheduleSelect)
    .from(schema.users)
    .where(eq(schema.users.id, userId));
  if (!user) return null;
  return {
    ...user,
    weeklySchedule: normalizeWeeklySchedule(user.weeklySchedule),
    pendingWeeklySchedule: normalizeWeeklySchedule(user.pendingWeeklySchedule)
  };
}

/** Promote pending schedules whose effective date has arrived (today or earlier). */
export async function promoteAllDueEmployeeSchedules(): Promise<number> {
  const today = getLocalDateString();
  const dueUsers = await db
    .select({
      id: schema.users.id,
      pendingExpectedCheckInTime: schema.users.pendingExpectedCheckInTime,
      pendingExpectedShiftEndTime: schema.users.pendingExpectedShiftEndTime,
      pendingWeeklySchedule: schema.users.pendingWeeklySchedule
    })
    .from(schema.users)
    .where(
      and(
        isNotNull(schema.users.scheduleEffectiveFrom),
        lte(schema.users.scheduleEffectiveFrom, today as any)
      )
    );

  for (const user of dueUsers) {
    const updateSet: Record<string, unknown> = {
      pendingExpectedCheckInTime: null,
      pendingExpectedShiftEndTime: null,
      scheduleEffectiveFrom: null,
      updatedAt: new Date()
    };
    if (user.pendingExpectedCheckInTime != null || user.pendingExpectedShiftEndTime != null) {
      updateSet.expectedCheckInTime = normalizeOptionalTime(user.pendingExpectedCheckInTime);
      updateSet.expectedShiftEndTime = normalizeOptionalTime(user.pendingExpectedShiftEndTime);
    }
    if (user.pendingWeeklySchedule) {
      updateSet.weeklySchedule = normalizeWeeklySchedule(user.pendingWeeklySchedule);
      updateSet.pendingWeeklySchedule = null;
    }
    await db.update(schema.users).set(updateSet).where(eq(schema.users.id, user.id));
  }

  return dueUsers.length;
}

export async function getExpectedScheduleForEmployeeOnDate(
  userId: number,
  asOfDate?: string
): Promise<ResolvedEmployeeSchedule> {
  const date = asOfDate ?? getLocalDateString();
  await promoteAllDueEmployeeSchedules();

  const office = await getAttendanceOfficeHours();
  const user = await loadUserScheduleFields(userId);
  return resolveEmployeeScheduleForDate(user ?? emptyUserScheduleFields, office, date);
}

export async function getExpectedCheckInTimeForEmployee(
  userId: number,
  asOfDate?: string
): Promise<string> {
  const resolved = await getExpectedScheduleForEmployeeOnDate(userId, asOfDate);
  return resolved.effectiveExpectedCheckInTime;
}

export async function getExpectedShiftEndTimeForEmployee(
  userId: number,
  asOfDate?: string
): Promise<string> {
  const resolved = await getExpectedScheduleForEmployeeOnDate(userId, asOfDate);
  return resolved.effectiveExpectedShiftEndTime;
}

export type EmployeeScheduleSummary = {
  userId: number;
  weeklyScheduleEnabled: boolean;
  weeklySchedule: EmployeeWeeklySchedule | null;
  pendingWeeklySchedule: EmployeeWeeklySchedule | null;
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
  isWorkingDayToday: boolean;
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
    user ?? emptyUserScheduleFields,
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
    weeklyScheduleEnabled: user?.weeklyScheduleEnabled ?? false,
    weeklySchedule: user?.weeklySchedule ?? null,
    pendingWeeklySchedule: hasPendingSchedule ? user?.pendingWeeklySchedule ?? null : null,
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
    isWorkingDayToday: active.isWorkingDay,
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
  weeklyScheduleEnabled?: boolean;
  weeklySchedule?: EmployeeWeeklySchedule | null;
}): Promise<EmployeeScheduleSummary> {
  const checkInNormalized = normalizeOptionalTime(params.expectedCheckInTime);
  const shiftEndNormalized = normalizeOptionalTime(params.expectedShiftEndTime);
  const weeklyEnabled = params.weeklyScheduleEnabled ?? false;
  const weeklySchedule = weeklyEnabled
    ? normalizeWeeklySchedule(params.weeklySchedule)
    : null;

  if (checkInNormalized && !isValidOfficeTime(checkInNormalized)) {
    throw new Error("Invalid check-in time. Use HH:mm (24-hour format).");
  }
  if (shiftEndNormalized && !isValidOfficeTime(shiftEndNormalized)) {
    throw new Error("Invalid check-out time. Use HH:mm (24-hour format).");
  }
  if (weeklyEnabled) {
    if (!weeklySchedule) {
      throw new Error("Weekly schedule is required when weekly mode is enabled.");
    }
    const validationError = validateWeeklySchedule(weeklySchedule);
    if (validationError) {
      throw new Error(validationError);
    }
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
        ...(weeklyEnabled
          ? {}
          : {
              expectedCheckInTime: checkInNormalized,
              expectedShiftEndTime: shiftEndNormalized
            }),
        pendingExpectedCheckInTime: null,
        pendingExpectedShiftEndTime: null,
        weeklyScheduleEnabled: weeklyEnabled,
        weeklySchedule: weeklyEnabled ? weeklySchedule : null,
        pendingWeeklySchedule: null,
        scheduleEffectiveFrom: null,
        updatedAt: new Date()
      })
      .where(eq(schema.users.id, params.userId));
  } else {
    await db
      .update(schema.users)
      .set({
        ...(weeklyEnabled
          ? {}
          : {
              pendingExpectedCheckInTime: checkInNormalized,
              pendingExpectedShiftEndTime: shiftEndNormalized
            }),
        weeklyScheduleEnabled: weeklyEnabled,
        pendingWeeklySchedule: weeklyEnabled ? weeklySchedule : null,
        scheduleEffectiveFrom: effectiveFromRaw as any,
        updatedAt: new Date()
      })
      .where(eq(schema.users.id, params.userId));
  }

  return getEmployeeScheduleSummary(params.userId);
}

export async function createInitialWeeklyScheduleForUser(
  userId: number,
  office?: AttendanceOfficeHours
): Promise<EmployeeWeeklySchedule> {
  const hours = office ?? (await getAttendanceOfficeHours());
  return createDefaultWeeklySchedule({
    checkInTime: hours.expectedCheckInTime,
    shiftEndTime: hours.shiftEndTime
  });
}

export { isWeeklyDayWorking };

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
