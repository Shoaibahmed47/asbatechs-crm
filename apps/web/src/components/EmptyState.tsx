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
        className="pointer-events-none absolute inset-x-8 top-1/2 h-32 -translate-y-1/2 rounded-full bg-gradient-to-br from-sky-400/20 via-cyan-400/10 to-transparent blur-2xl dark:from-sky-500/25 dark:via-cyan-500/10"
        aria-hidden
      />
      <div className="relative">
        <div className="mx-auto flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-2xl border-2 border-sky-200/90 bg-gradient-to-br from-white to-sky-50 text-sky-600 shadow-[0_12px_40px_-12px_rgba(14,165,233,0.45)] dark:border-sky-500/40 dark:from-slate-900 dark:to-sky-950/80 dark:text-sky-400 dark:shadow-[0_12px_40px_-12px_rgba(56,189,248,0.25)]">
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
