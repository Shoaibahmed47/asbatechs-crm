export type AttendanceStatusKind = "active" | "break" | "idle" | "offline";

/** Canonical unscheduled-away causes used across attendance APIs and UI. */
export const UNSCHEDULED_CAUSE = {
  IDLE: "idle",
  SLEEP: "sleep"
} as const;

export type UnscheduledCause =
  (typeof UNSCHEDULED_CAUSE)[keyof typeof UNSCHEDULED_CAUSE];

/** Stable reason-code enum for admin-facing attendance explanations. */
export const ATTENDANCE_REASON_CODE = {
  OFFLINE_NOT_CLOCKED_IN: "offline_not_clocked_in",
  OFFLINE_CHECKED_OUT: "offline_checked_out",
  BREAK_OFFICIAL: "break_official",
  BREAK_SLEEP: "break_sleep",
  IDLE_SLEEP: "idle_sleep",
  IDLE_AGENT: "idle_agent",
  IDLE_BROWSER: "idle_browser",
  ACTIVE_WITH_ACTIVITY: "active_with_activity",
  ACTIVE_DEFAULT: "active_default"
} as const;

export type AttendanceReasonCode =
  (typeof ATTENDANCE_REASON_CODE)[keyof typeof ATTENDANCE_REASON_CODE];

/** Human-readable attendance status explanation for admin reports. */
export function buildAttendanceReason(params: {
  attendanceStatus: AttendanceStatusKind;
  clockOut: string | Date | null;
  openUnscheduledCause?: UnscheduledCause;
  lastActivitySource?: string | null;
  lastActivityAt?: string | Date | null;
}): string {
  const { attendanceStatus, clockOut, openUnscheduledCause, lastActivitySource, lastActivityAt } =
    params;
  const source =
    (lastActivitySource ?? "").toLowerCase() === "agent" ? "desktop agent" : "browser";

  const reasonCode: AttendanceReasonCode = (() => {
    if (attendanceStatus === "offline") {
      return clockOut
        ? ATTENDANCE_REASON_CODE.OFFLINE_CHECKED_OUT
        : ATTENDANCE_REASON_CODE.OFFLINE_NOT_CLOCKED_IN;
    }
    if (attendanceStatus === "break") {
      return openUnscheduledCause === UNSCHEDULED_CAUSE.SLEEP
        ? ATTENDANCE_REASON_CODE.BREAK_SLEEP
        : ATTENDANCE_REASON_CODE.BREAK_OFFICIAL;
    }
    if (attendanceStatus === "idle") {
      if (openUnscheduledCause === UNSCHEDULED_CAUSE.SLEEP) {
        return ATTENDANCE_REASON_CODE.IDLE_SLEEP;
      }
      return source === "desktop agent"
        ? ATTENDANCE_REASON_CODE.IDLE_AGENT
        : ATTENDANCE_REASON_CODE.IDLE_BROWSER;
    }
    if (lastActivityAt) {
      return ATTENDANCE_REASON_CODE.ACTIVE_WITH_ACTIVITY;
    }
    return ATTENDANCE_REASON_CODE.ACTIVE_DEFAULT;
  })();

  if (reasonCode === ATTENDANCE_REASON_CODE.ACTIVE_WITH_ACTIVITY) {
    return `Working (last activity via ${source}).`;
  }

  const reasonMessageByCode: Record<Exclude<AttendanceReasonCode, "active_with_activity">, string> =
    {
      [ATTENDANCE_REASON_CODE.OFFLINE_NOT_CLOCKED_IN]: "Not clocked in.",
      [ATTENDANCE_REASON_CODE.OFFLINE_CHECKED_OUT]: "Checked out (shift closed).",
      [ATTENDANCE_REASON_CODE.BREAK_OFFICIAL]: "On official break.",
      [ATTENDANCE_REASON_CODE.BREAK_SLEEP]: "Laptop lock/sleep detected.",
      [ATTENDANCE_REASON_CODE.IDLE_SLEEP]: "Laptop lock/sleep detected during duty.",
      [ATTENDANCE_REASON_CODE.IDLE_AGENT]: "No activity detected by desktop agent.",
      [ATTENDANCE_REASON_CODE.IDLE_BROWSER]: "No activity detected in attendance page.",
      [ATTENDANCE_REASON_CODE.ACTIVE_DEFAULT]: "Working."
    };

  return reasonMessageByCode[reasonCode as Exclude<AttendanceReasonCode, "active_with_activity">];
}
