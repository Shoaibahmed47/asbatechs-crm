import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.14),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(37,99,235,0.14),transparent_24%)]" />
      <div className="relative w-full max-w-5xl overflow-hidden rounded-[28px] border border-white/40 bg-white/70 shadow-[0_28px_80px_rgba(15,23,42,0.14)] backdrop-blur-2xl dark:border-slate-800/80 dark:bg-slate-950/70">
        <div className="grid grid-cols-1 md:grid-cols-[1.15fr_0.95fr]">
          <div className="hidden bg-[linear-gradient(160deg,#0f172a_0%,#0b1f3a_55%,#0f3d67_100%)] p-10 text-slate-50 md:flex md:flex-col md:justify-between">
            <div>
              <div className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.22em] text-sky-100">
                Operations platform
              </div>
              <h1 className="mt-6 text-4xl font-semibold tracking-tight">
                AsbaTechs CRM
              </h1>
              <p className="mt-4 max-w-md text-sm leading-7 text-slate-200">
                Centralized attendance, lead operations, and sales reporting for
                teams that need clarity, speed, and trustworthy operational data.
              </p>
            </div>
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-100/80">
                  Built for teams
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-200">
                  A cleaner workspace for monitoring activity, reviewing pipeline
                  health, and keeping internal workflows aligned.
                </p>
              </div>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-300/90">
                Professional internal software for daily operations
              </p>
            </div>
          </div>
          <div className="bg-white/70 p-8 backdrop-blur-xl dark:bg-slate-950/50 md:p-10">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
