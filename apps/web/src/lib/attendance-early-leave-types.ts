/** Client-safe early leave explanation payload (no database imports). */
export type PendingEarlyLeaveExplanation = {
  attendanceLogId: number;
  date: string;
  dateLabel: string;
  earlyLeaveMinutes: number;
  expectedShiftEndTime: string;
  expectedShiftEndLabel: string;
  clockOut: string;
  clockOutLabel: string;
};
