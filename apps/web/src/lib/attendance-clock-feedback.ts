import { formatAttendanceDurationReadable } from "@/lib/attendance-date";

export type ClockInFeedbackKind = "early" | "on_time" | "late";

export function buildClockInFeedbackMessage(
  kind: ClockInFeedbackKind,
  lateMinutes: number
): string {
  if (kind === "early") {
    return "You're early today. Great discipline.";
  }
  if (kind === "late") {
    const duration = formatAttendanceDurationReadable(lateMinutes);
    return `You're ${duration} late today. You can still have a strong shift.`;
  }
  return "You're on time today. Nice start.";
}

export function buildClockOutFeedbackMessage(workMinutes: number): string {
  const duration = formatAttendanceDurationReadable(workMinutes);
  return `Shift complete. You worked ${duration} today.`;
}

export function classifyClockInFeedback(
  rawLateMinutes: number,
  recordedLateMinutes: number
): ClockInFeedbackKind {
  if (recordedLateMinutes > 0) return "late";
  if (rawLateMinutes < 0) return "early";
  return "on_time";
}
