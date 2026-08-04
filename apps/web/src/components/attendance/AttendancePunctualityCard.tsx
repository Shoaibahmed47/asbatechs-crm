import { Sparkles } from "lucide-react";
import type { EmployeePunctualityStats } from "@/lib/attendance-punctuality-shared";
import { buildPunctualityStreakLabel } from "@/lib/attendance-punctuality-shared";

type Props = {
  stats: EmployeePunctualityStats | null;
  loading?: boolean;
};

export function AttendancePunctualityCard({ stats, loading }: Props) {
  if (loading) {
    return (
      <div className="flex gap-3 rounded-2xl border border-brand-200/90 bg-gradient-to-r from-brand-50/90 via-white to-white px-4 py-4 shadow-sm dark:border-brand-800/60 dark:from-brand-950/25 dark:via-slate-950 dark:to-slate-950">
        <div className="h-10 w-10 shrink-0 rounded-xl border border-brand-200/80 bg-white dark:border-brand-800/70 dark:bg-brand-950/50" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-4 w-40 rounded bg-slate-200/80 dark:bg-slate-800" />
          <div className="h-3 w-56 rounded bg-slate-100 dark:bg-slate-900" />
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const streakLabel = buildPunctualityStreakLabel(stats);

  return (
    <div
      className="flex gap-3 rounded-2xl border border-brand-200/90 bg-gradient-to-r from-brand-50/90 via-white to-white px-4 py-4 shadow-sm dark:border-brand-800/60 dark:from-brand-950/25 dark:via-slate-950 dark:to-slate-950"
      role="status"
      aria-live="polite"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-brand-200/80 bg-white text-brand-600 dark:border-brand-800/70 dark:bg-brand-950/50 dark:text-brand-300">
        <Sparkles className="h-5 w-5" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-base font-semibold leading-snug text-brand-800 dark:text-brand-200">
          Your punctuality
        </p>
        <p className="mt-2 text-base leading-relaxed text-slate-700 dark:text-slate-300">
          <strong className="font-semibold text-slate-900 dark:text-slate-100">
            {stats.weekOnTimeDays}
          </strong>
          on-time{" "}
          {stats.weekClockInDays === 1 ? "day" : "days"} this week
          {stats.weekClockInDays > 0 ? (
            <span className="text-slate-500 dark:text-slate-400">
              {" "}
              · {stats.weekClockInDays} clocked in
            </span>
          ) : null}
        </p>
        <p className="mt-1 text-base leading-relaxed text-slate-600 dark:text-slate-400">
          Streak: {streakLabel}
        </p>
      </div>
    </div>
  );
}
