import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  children?: ReactNode;
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  children
}: EmptyStateProps) {
  return (
    <div className="relative mx-auto max-w-md px-6 py-16 text-center">
      <div
        className="pointer-events-none absolute inset-x-8 top-1/2 h-32 -translate-y-1/2 rounded-full bg-gradient-to-br from-brand-400/20 via-brand-400/10 to-transparent blur-2xl dark:from-brand-500/25 dark:via-brand-500/10"
        aria-hidden
      />
      <div className="relative">
        <div className="mx-auto flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-2xl border-2 border-brand-200/90 bg-gradient-to-br from-white to-brand-50 text-brand-600 shadow-[0_12px_40px_-12px_color-mix(in srgb, var(--brand-teal-light) 45%, transparent)] dark:border-brand-500/40 dark:from-slate-900 dark:to-brand-950/80 dark:text-brand-400 dark:shadow-[0_12px_40px_-12px_color-mix(in srgb, var(--brand-teal-light) 25%, transparent)]">
          <Icon className="h-9 w-9" strokeWidth={1.25} aria-hidden />
        </div>
        <h3 className="card-title mt-6 tracking-tight text-slate-900 dark:text-slate-50">
          {title}
        </h3>
        <p className="mt-3 text-base leading-relaxed text-slate-600 dark:text-slate-400">
          {description}
        </p>
        {children ? (
          <div className="mt-8 flex flex-wrap justify-center gap-3">{children}</div>
        ) : null}
      </div>
    </div>
  );
}
