import {
  createSaturdayWorkerWeeklySchedule,
  isWeeklyDayWorking,
  validateWeeklySchedule,
  weekdayKeyFromDate
} from "@/lib/attendance-weekly-schedule";

describe("attendance weekly schedule", () => {
  it("maps calendar dates to weekday keys", () => {
    expect(weekdayKeyFromDate("2026-06-06")).toBe("sat");
    expect(weekdayKeyFromDate("2026-06-07")).toBe("sun");
    expect(weekdayKeyFromDate("2026-06-08")).toBe("mon");
  });

  it("validates saturday worker template", () => {
    const schedule = createSaturdayWorkerWeeklySchedule();
    expect(validateWeeklySchedule(schedule)).toBeNull();
    expect(isWeeklyDayWorking(schedule, "2026-06-06")).toBe(true);
    expect(isWeeklyDayWorking(schedule, "2026-06-07")).toBe(false);
  });
});
