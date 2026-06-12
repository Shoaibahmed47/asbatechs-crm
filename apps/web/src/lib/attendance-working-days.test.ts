import {
  getExplanationPromptDueDate,
  isAttendanceWeekend,
  isExplanationPromptDue
} from "@/lib/attendance-working-days";

jest.mock("@/lib/attendance-policy", () => ({
  ATTENDANCE_LATE_EXPLANATION_TEST_MODE: false
}));

describe("attendance working days", () => {
  it("treats Saturday and Sunday as weekend", () => {
    expect(isAttendanceWeekend("2026-06-06")).toBe(true); // Sat
    expect(isAttendanceWeekend("2026-06-07")).toBe(true); // Sun
    expect(isAttendanceWeekend("2026-06-05")).toBe(false); // Fri
  });

  it("Friday late explanation due on Monday", () => {
    expect(getExplanationPromptDueDate("2026-06-05")).toBe("2026-06-08");
    expect(isExplanationPromptDue("2026-06-05", "2026-06-06")).toBe(false);
    expect(isExplanationPromptDue("2026-06-05", "2026-06-08")).toBe(true);
  });
});
