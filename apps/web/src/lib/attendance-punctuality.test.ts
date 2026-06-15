import { buildPunctualityStreakLabel } from "./attendance-punctuality-shared";

jest.mock("@/lib/db", () => ({
  db: {
    select: jest.fn()
  }
}));

describe("attendance-punctuality", () => {
  it("builds streak label for active streak", () => {
    expect(
      buildPunctualityStreakLabel({
        weekOnTimeDays: 3,
        weekClockInDays: 3,
        currentStreak: 3,
        streakIncludesToday: true,
        lateToday: false
      })
    ).toBe("3 days on time (includes today)");
  });

  it("builds gentle label when late today", () => {
    expect(
      buildPunctualityStreakLabel({
        weekOnTimeDays: 2,
        weekClockInDays: 3,
        currentStreak: 0,
        streakIncludesToday: false,
        lateToday: true
      })
    ).toBe("Late today — back on track tomorrow.");
  });
});
