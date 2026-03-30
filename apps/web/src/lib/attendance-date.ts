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
