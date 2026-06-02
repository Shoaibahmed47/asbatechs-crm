/**
 * Calendar date in the user's local timezone (YYYY-MM-DD).
 * Attendance is keyed by local day, not UTC (avoids wrong-day bugs near midnight).
 */
export function getLocalDateString(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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
