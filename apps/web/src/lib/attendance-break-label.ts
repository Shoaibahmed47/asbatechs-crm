import { UNSCHEDULED_CAUSE } from "@/lib/attendance-reason";

export type BreakSessionForLabel = {
  breakType?: string | null;
  unscheduledCause?: string | null;
  returnReason?: string | null;
};

/** Display label for a break row (custom reason, official break, or inactive type). */
export function breakSessionReasonLabel(session: BreakSessionForLabel): string {
  const custom = session.returnReason?.trim();
  if (custom) return custom;
  if (session.breakType === "manual") return "Official break";
  if (session.breakType === "extra") return "Extra break";
  if (session.unscheduledCause === UNSCHEDULED_CAUSE.SLEEP) return "Away (laptop sleep/lock)";
  if (session.unscheduledCause === UNSCHEDULED_CAUSE.TAB_CLOSE) return "Away (Attendance tab closed)";
  if (session.unscheduledCause === UNSCHEDULED_CAUSE.CURSOR_IDLE) return "Away (no cursor movement)";
  if (session.breakType === "unscheduled") return "Unscheduled inactive";
  return "-";
}

