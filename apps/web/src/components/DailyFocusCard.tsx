"use client";

/**
 * Sidebar "Daily focus" callout with subtle animated copy and glow.
 */
export function DailyFocusCard() {
  return (
    <div className="daily-focus-card relative overflow-hidden rounded-2xl border border-sky-200/60 bg-gradient-to-br from-white via-slate-50/90 to-sky-50/50 p-4 shadow-[0_0_28px_-4px_rgba(56,189,248,0.35),0_8px_24px_-8px_rgba(15,23,42,0.12)] dark:border-sky-500/25 dark:from-slate-900/90 dark:via-slate-900/80 dark:to-sky-950/40 dark:shadow-[0_0_32px_-6px_rgba(34,211,238,0.2),0_12px_28px_-10px_rgba(0,0,0,0.4)] 2xl:p-5">
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-sky-400/20 blur-2xl dark:bg-cyan-400/15"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-6 -left-6 h-20 w-20 rounded-full bg-cyan-400/15 blur-2xl dark:bg-sky-500/10"
        aria-hidden
      />

      <div className="relative">
        <div className="text-sm font-semibold uppercase tracking-[0.14em] text-sky-700/90 dark:text-sky-300/95">
          Daily focus
        </div>
        <p className="daily-focus-animated-text mt-3 text-base leading-7 text-slate-600 dark:text-slate-300">
          <span className="font-semibold text-sky-700 dark:text-sky-300">Review</span> new leads, verify active{" "}
          <span className="font-semibold text-sky-700 dark:text-sky-300">attendance</span>, and keep{" "}
          <span className="font-semibold text-cyan-700 dark:text-cyan-300">department</span> ownership current.
        </p>
      </div>
    </div>
  );
}
