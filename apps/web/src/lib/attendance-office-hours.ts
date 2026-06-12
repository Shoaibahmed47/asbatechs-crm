/** Client-safe office hours types and display helpers (no database imports). */

export type AttendanceOfficeHours = {
  expectedCheckInTime: string;
  shiftEndTime: string;
  lateGraceMinutes: number;
  updatedAt: string | null;
};

export const DEFAULT_OFFICE_CHECK_IN_TIME = "19:00";
export const DEFAULT_OFFICE_SHIFT_END_TIME = "16:00";
export const DEFAULT_LATE_GRACE_MINUTES = 15;

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidOfficeTime(value: string): boolean {
  return TIME_PATTERN.test(value.trim());
}

export function formatOfficeTimeLabel(value: string): string {
  if (!isValidOfficeTime(value)) return value;
  const [hourPart, minutePart] = value.split(":");
  const hour = Number(hourPart);
  const minute = Number(minutePart);
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
}

export function officeShiftEndsNextDay(
  expectedCheckInTime: string,
  shiftEndTime: string
): boolean {
  if (!isValidOfficeTime(expectedCheckInTime) || !isValidOfficeTime(shiftEndTime)) {
    return false;
  }
  const [startH, startM] = expectedCheckInTime.split(":").map(Number);
  const [endH, endM] = shiftEndTime.split(":").map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  return endMinutes <= startMinutes;
}
