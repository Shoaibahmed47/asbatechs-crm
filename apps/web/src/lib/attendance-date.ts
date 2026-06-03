export const ATTENDANCE_TIME_ZONE =
  process.env.NEXT_PUBLIC_ATTENDANCE_TIME_ZONE || "Asia/Karachi";

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
  return new Date(iso).toLocaleTimeString(undefined, {
    timeZone: ATTENDANCE_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function formatAttendanceDateTime(iso: string | Date | null | undefined): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString(undefined, {
    timeZone: ATTENDANCE_TIME_ZONE,
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
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

/** Inclusive list of YYYY-MM-DD strings from `from` through `to` (local calendar days). */
export function enumerateLocalDates(from: string, to: string): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return [];
  }
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];

  const lo = start.getTime() <= end.getTime() ? start : end;
  const hi = start.getTime() <= end.getTime() ? end : start;
  const out: string[] = [];
  const cursor = new Date(lo);
  while (cursor.getTime() <= hi.getTime()) {
    out.push(getLocalDateString(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}
