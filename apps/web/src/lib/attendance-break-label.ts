import { formatBreakCategoryLabel } from "@/lib/attendance-break-shared";
import { UNSCHEDULED_CAUSE } from "@/lib/attendance-reason";

export type BreakSessionForLabel = {
  breakType?: string | null;
  breakCategory?: string | null;
  startNote?: string | null;
  endNote?: string | null;
  unscheduledCause?: string | null;
  returnReason?: string | null;
};

/** Display label for a break row (manual break notes or inactive type). */
export function breakSessionReasonLabel(session: BreakSessionForLabel): string {
  if (session.breakType === "manual") {
    const category = formatBreakCategoryLabel(session.breakCategory);
    const where = session.startNote?.trim();
    const parts = [category];
    if (where) parts.push(`where: ${where}`);
    const end = session.endNote?.trim();
    if (end) parts.push(`return: ${end}`);
    return parts.join(" · ");
  }

  const custom = session.returnReason?.trim();
  if (custom) return custom;
  if (session.breakType === "extra") return "Extra break";
  if (session.unscheduledCause === UNSCHEDULED_CAUSE.SLEEP) return "Away (laptop sleep/lock)";
  if (session.unscheduledCause === UNSCHEDULED_CAUSE.TAB_CLOSE)
    return "Away (Attendance tab closed)";
  if (session.unscheduledCause === UNSCHEDULED_CAUSE.CURSOR_IDLE)
    return "Away (no cursor movement)";
  if (session.breakType === "unscheduled") return "Unscheduled inactive";
  return "-";
}
