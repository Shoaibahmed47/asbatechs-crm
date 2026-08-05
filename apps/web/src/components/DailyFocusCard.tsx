"use client";

/**
 * Compact sidebar callout (Apple-shell footer).
 */
export function DailyFocusCard() {
  return (
    <div className="relative overflow-hidden rounded-[12px] bg-[color-mix(in_srgb,var(--teal-60)_88%,hsl(var(--card)))] px-3 py-2.5 dark:bg-[color-mix(in_srgb,var(--teal-80)_55%,transparent)]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--brand-fg)]">
        Daily focus
      </div>
      <p className="daily-focus-animated-text mt-1.5 text-[12px] leading-snug text-slate-600 dark:text-slate-300">
        <span className="font-semibold text-[var(--brand-fg)]">Review</span> leads,{" "}
        <span className="font-semibold text-[var(--brand-fg)]">attendance</span>, and ownership.
      </p>
    </div>
  );
}
