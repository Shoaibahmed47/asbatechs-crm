import {
  buildClockInFeedbackMessage,
  buildClockOutFeedbackMessage,
  classifyClockInFeedback
} from "./attendance-clock-feedback";

describe("attendance-clock-feedback", () => {
  it("classifies early, on time, and late clock-in", () => {
    expect(classifyClockInFeedback(-5, 0)).toBe("early");
    expect(classifyClockInFeedback(5, 0)).toBe("on_time");
    expect(classifyClockInFeedback(20, 20)).toBe("late");
  });

  it("builds friendly clock-in messages", () => {
    expect(buildClockInFeedbackMessage("on_time", 0)).toContain("on time");
    expect(buildClockInFeedbackMessage("late", 79)).toContain("1 hour 19 min");
  });

  it("builds clock-out message with worked duration", () => {
    expect(buildClockOutFeedbackMessage(125)).toContain("2 hours 5 min");
  });
});
