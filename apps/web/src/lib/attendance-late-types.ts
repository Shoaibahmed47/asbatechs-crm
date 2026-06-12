/** Client-safe late explanation payload (no database imports). */
export type PendingLateExplanation = {
  attendanceLogId: number;
  date: string;
  dateLabel: string;
  lateMinutes: number;
  expectedCheckInTime: string;
  expectedCheckInLabel: string;
  clockIn: string;
  clockInLabel: string;
};
