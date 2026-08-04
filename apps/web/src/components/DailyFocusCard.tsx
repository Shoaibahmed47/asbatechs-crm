"use client";

/**
 * Sidebar "Daily focus" callout with subtle animated copy and glow.
 */
export function DailyFocusCard() {
  return (
    <div className="daily-focus-card relative overflow-hidden rounded-xl border border-brand-200/60 bg-gradient-to-br from-white via-slate-50/90 to-brand-50/50 p-3 shadow-[0_0_28px_-4px_color-mix(in_srgb,var(--brand-teal-light)_35%,transparent),0_8px_24px_-8px_rgba(15,23,42,0.12)] dark:border-brand-500/25 dark:from-slate-900/90 dark:via-slate-900/80 dark:to-brand-950/40 dark:shadow-[0_0_32px_-6px_color-mix(in_srgb,var(--brand-teal-lighter)_20%,transparent),0_12px_28px_-10px_rgba(0,0,0,0.4)] 2xl:rounded-2xl 2xl:p-4">
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-brand-400/20 blur-2xl dark:bg-brand-400/15"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-6 -left-6 h-20 w-20 rounded-full bg-brand-400/15 blur-2xl dark:bg-brand-500/10"
        aria-hidden
      />

      <div className="relative">
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-700/90 dark:text-brand-300/95 2xl:text-sm">
          Daily focus
        </div>
        <p className="daily-focus-animated-text mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300 2xl:mt-3 2xl:text-base 2xl:leading-7">
          <span className="font-semibold text-brand-700 dark:text-brand-300">Review</span> new leads, verify active{" "}
          <span className="font-semibold text-brand-700 dark:text-brand-300">attendance</span>, and keep{" "}
          <span className="font-semibold text-brand-700 dark:text-brand-300">department</span> ownership current.
        </p>
      </div>
    </div>
  );
}
