import type { ReactNode } from "react";
import Link from "next/link";

type Props = {
  title: string;
  subtitle: string;
  children: ReactNode;
  backHref?: string;
  backLabel?: string;
};

export function AuthPageShell({
  title,
  subtitle,
  children,
  backHref = "/login",
  backLabel = "Back to login"
}: Props) {
  return (
    <div className="auth-shell app-shell relative flex min-h-screen items-center justify-center px-3 py-6 sm:px-4 sm:py-10">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,color-mix(in srgb, var(--brand-teal-light) 16%, transparent),transparent_36%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute left-[9%] top-[16%] h-12 w-12 rotate-12 rounded-xl bg-brand-100/70 dark:bg-brand-900/30"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute right-[11%] top-[20%] h-11 w-11 -rotate-12 rounded-xl bg-brand-100/70 dark:bg-brand-900/30"
        aria-hidden
      />

      <div className="surface-reveal relative w-full max-w-md rounded-2xl border border-slate-200/80 bg-white/95 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.12)] dark:border-slate-700/80 dark:bg-slate-950/95 sm:rounded-3xl sm:p-8">
        <div className="inline-flex items-center rounded-full border border-brand-200/80 bg-brand-50 px-3.5 py-1.5 text-sm font-semibold uppercase tracking-[0.18em] text-brand-700 dark:border-brand-800 dark:bg-brand-950/40 dark:text-brand-300">
          AsbaTechs CRM
        </div>
        <h1 className="page-title mt-5">
          {title}
        </h1>
        <p className="page-subtitle">{subtitle}</p>

        <div className="mt-6">{children}</div>

        {backHref ? (
          <p className="mt-6 text-center text-base text-slate-500 dark:text-slate-400">
            <Link
              href={backHref}
              className="font-medium text-brand-700 hover:text-brand-800 dark:text-brand-300 dark:hover:text-brand-200"
            >
              {backLabel}
            </Link>
          </p>
        ) : null}
      </div>
    </div>
  );
}
