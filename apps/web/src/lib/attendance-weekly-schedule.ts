import type { EmployeeWeeklySchedule, WeeklyDaySchedule } from "@asbatechs-crm/database";
import { getAttendanceWeekday } from "@/lib/attendance-working-days";
import { isValidOfficeTime } from "@/lib/attendance-office-hours";

export type WeeklyScheduleDayKey = keyof EmployeeWeeklySchedule;

export const WEEKLY_SCHEDULE_DAY_KEYS: WeeklyScheduleDayKey[] = [
  "sun",
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat"
];

export const WEEKLY_SCHEDULE_DAY_LABELS: Record<WeeklyScheduleDayKey, string> = {
  sun: "Sunday",
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday"
};

const WEEKDAY_TO_KEY: Record<number, WeeklyScheduleDayKey> = {
  0: "sun",
  1: "mon",
  2: "tue",
  3: "wed",
  4: "thu",
  5: "fri",
  6: "sat"
};

export function weekdayKeyFromDate(dateStr: string): WeeklyScheduleDayKey {
  return WEEKDAY_TO_KEY[getAttendanceWeekday(dateStr)] ?? "sun";
}

function offDay(): WeeklyDaySchedule {
  return { isWorking: false, checkInTime: null, shiftEndTime: null };
}

function workingDay(checkInTime: string, shiftEndTime: string): WeeklyDaySchedule {
  return { isWorking: true, checkInTime, shiftEndTime };
}

/** Mon–Fri working with office hours; Sat/Sun off. */
export function createDefaultWeeklySchedule(params: {
  checkInTime: string;
  shiftEndTime: string;
}): EmployeeWeeklySchedule {
  const weekday = workingDay(params.checkInTime, params.shiftEndTime);
  return {
    sun: offDay(),
    mon: weekday,
    tue: weekday,
    wed: weekday,
    thu: weekday,
    fri: weekday,
    sat: offDay()
  };
}

/** Sat worker pattern: Mon/Sat half (18:00–23:00), Tue–Fri night (18:00–03:00), Sun off. */
export function createSaturdayWorkerWeeklySchedule(): EmployeeWeeklySchedule {
  const halfEvening = workingDay("18:00", "23:00");
  const fullNight = workingDay("18:00", "03:00");
  return {
    sun: offDay(),
    mon: halfEvening,
    tue: fullNight,
    wed: fullNight,
    thu: fullNight,
    fri: fullNight,
    sat: halfEvening
  };
}

function normalizeDaySchedule(value: unknown): WeeklyDaySchedule {
  if (!value || typeof value !== "object") {
    return offDay();
  }
  const raw = value as Partial<WeeklyDaySchedule>;
  const isWorking = Boolean(raw.isWorking);
  if (!isWorking) {
    return offDay();
  }

  const checkInTime =
    typeof raw.checkInTime === "string" && isValidOfficeTime(raw.checkInTime.trim())
      ? raw.checkInTime.trim()
      : null;
  const shiftEndTime =
    typeof raw.shiftEndTime === "string" && isValidOfficeTime(raw.shiftEndTime.trim())
      ? raw.shiftEndTime.trim()
      : null;

  return {
    isWorking: true,
    checkInTime,
    shiftEndTime
  };
}

export function normalizeWeeklySchedule(value: unknown): EmployeeWeeklySchedule | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<EmployeeWeeklySchedule>;
  return {
    sun: normalizeDaySchedule(raw.sun),
    mon: normalizeDaySchedule(raw.mon),
    tue: normalizeDaySchedule(raw.tue),
    wed: normalizeDaySchedule(raw.wed),
    thu: normalizeDaySchedule(raw.thu),
    fri: normalizeDaySchedule(raw.fri),
    sat: normalizeDaySchedule(raw.sat)
  };
}

export function validateWeeklySchedule(schedule: EmployeeWeeklySchedule): string | null {
  for (const key of WEEKLY_SCHEDULE_DAY_KEYS) {
    const day = schedule[key];
    if (!day.isWorking) continue;
    if (!day.checkInTime || !isValidOfficeTime(day.checkInTime)) {
      return `${WEEKLY_SCHEDULE_DAY_LABELS[key]}: check-in time is required (HH:mm).`;
    }
    if (!day.shiftEndTime || !isValidOfficeTime(day.shiftEndTime)) {
      return `${WEEKLY_SCHEDULE_DAY_LABELS[key]}: shift end time is required (HH:mm).`;
    }
  }
  return null;
}

export function getWeeklyDaySchedule(
  schedule: EmployeeWeeklySchedule | null | undefined,
  dateStr: string
): WeeklyDaySchedule | null {
  if (!schedule) return null;
  return schedule[weekdayKeyFromDate(dateStr)] ?? null;
}

export function isWeeklyDayWorking(
  schedule: EmployeeWeeklySchedule | null | undefined,
  dateStr: string
): boolean {
  const day = getWeeklyDaySchedule(schedule, dateStr);
  return Boolean(day?.isWorking);
}

export function formatWeeklyDaySummary(day: WeeklyDaySchedule): string {
  if (!day.isWorking) return "Off";
  if (!day.checkInTime || !day.shiftEndTime) return "Working (times not set)";
  return `${day.checkInTime} – ${day.shiftEndTime}`;
}
