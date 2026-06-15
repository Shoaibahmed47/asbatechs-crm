export const ATTENDANCE_TIME_ZONE =
  process.env.NEXT_PUBLIC_ATTENDANCE_TIME_ZONE || "Asia/Karachi";

/** Fixed locale so employee and admin always see the same 12-hour clock (e.g. 8:00 PM). */
export const ATTENDANCE_DISPLAY_LOCALE = "en-US";

const attendanceTimeFormat: Intl.DateTimeFormatOptions = {
  timeZone: ATTENDANCE_TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
  hour12: true
};

const attendanceDateTimeFormat: Intl.DateTimeFormatOptions = {
  timeZone: ATTENDANCE_TIME_ZONE,
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true
};

/**
 * Calendar date in the configured attendance timezone (YYYY-MM-DD).
 * Attendance is keyed by business day, not UTC (avoids wrong-day bugs near midnight).
 */
export function getLocalDateString(d = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ATTENDANCE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(d);
  const y = parts.find((part) => part.type === "year")?.value ?? String(d.getFullYear());
  const m =
    parts.find((part) => part.type === "month")?.value ??
    String(d.getMonth() + 1).padStart(2, "0");
  const day =
    parts.find((part) => part.type === "day")?.value ??
    String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatAttendanceClock(iso: string | Date | null | undefined): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleTimeString(ATTENDANCE_DISPLAY_LOCALE, attendanceTimeFormat);
}

export function formatAttendanceDateTime(iso: string | Date | null | undefined): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString(ATTENDANCE_DISPLAY_LOCALE, attendanceDateTimeFormat);
}

export function formatAttendanceDateLabel(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, {
    timeZone: ATTENDANCE_TIME_ZONE,
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

export function formatWorkDuration(minutes: number | null | undefined): string {
  if (minutes == null || Number.isNaN(minutes)) return "-";
  const safeMinutes = Math.max(0, Math.floor(minutes));
  const h = Math.floor(safeMinutes / 60);
  const m = safeMinutes % 60;
  if (h <= 0) return `${m} min`;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

/** Human-readable duration for late/early badges and modals (e.g. "1 hour 19 min"). */
export function formatAttendanceDurationReadable(minutes: number): string {
  const safeMinutes = Math.max(0, Math.floor(minutes));
  if (safeMinutes < 60) return `${safeMinutes} min`;
  const hours = Math.floor(safeMinutes / 60);
  const rem = safeMinutes % 60;
  const hourLabel = hours === 1 ? "hour" : "hours";
  if (rem === 0) return `${hours} ${hourLabel}`;
  return `${hours} ${hourLabel} ${rem} min`;
}

function addCalendarDays(iso: string, deltaDays: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const cursor = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  cursor.setUTCDate(cursor.getUTCDate() + deltaDays);
  const yy = cursor.getUTCFullYear();
  const mm = String(cursor.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(cursor.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** Inclusive list of YYYY-MM-DD strings from `from` through `to` (business calendar days). */
export function enumerateLocalDates(from: string, to: string): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return [];
  }

  const start = from <= to ? from : to;
  const end = from <= to ? to : from;
  const out: string[] = [];
  let cursor = start;
  while (cursor <= end) {
    out.push(cursor);
    if (cursor === end) break;
    cursor = addCalendarDays(cursor, 1);
  }
  return out;
}
