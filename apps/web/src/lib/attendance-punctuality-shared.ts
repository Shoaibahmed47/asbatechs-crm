export type EmployeePunctualityStats = {
  weekOnTimeDays: number;
  weekClockInDays: number;
  currentStreak: number;
  streakIncludesToday: boolean;
  lateToday: boolean;
};

export function buildPunctualityStreakLabel(stats: EmployeePunctualityStats): string {
  if (stats.lateToday) {
    return "Late today — back on track tomorrow.";
  }
  if (stats.currentStreak <= 0) {
    return "Start a new on-time streak today.";
  }
  const dayWord = stats.currentStreak === 1 ? "day" : "days";
  const suffix = stats.streakIncludesToday ? " (includes today)" : "";
  return `${stats.currentStreak} ${dayWord} on time${suffix}`;
}
