import type { ReactNode } from "react";
import { AppBreadcrumbs } from "@/components/AppBreadcrumbs";
import { AppHeaderUser } from "@/components/AppHeader";
import { AppSidebarNav } from "@/components/AppSidebarNav";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.12),transparent_26%),radial-gradient(circle_at_right,rgba(6,182,212,0.08),transparent_24%)]" />
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[292px] p-5 lg:block">
        <div className="app-panel flex h-full flex-col rounded-[28px] px-5 py-6">
          <div className="border-b border-slate-200/70 pb-6 dark:border-slate-800/80">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-600 dark:text-sky-300">
              AsbaTechs
            </div>
            <div className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
              CRM Workspace
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
              Operational oversight for leads, attendance, and internal team management.
            </p>
          </div>

          <AppSidebarNav />

          <div className="app-panel-muted rounded-2xl p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Daily focus
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Review new leads, verify active attendance, and keep department ownership current.
            </p>
          </div>
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-col lg:ml-[292px]">
        <header className="sticky top-0 z-10 px-4 pb-3 pt-4 sm:px-6 lg:px-8">
          <div className="app-panel flex flex-col gap-4 rounded-[24px] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                Internal operations console
              </div>
              <div className="mt-2 text-xl font-semibold tracking-tight text-slate-950 dark:text-white">
                Professional team workflow management
              </div>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                A cleaner control center for sales visibility, attendance tracking, and admin oversight.
              </p>
            </div>
            <AppHeaderUser />
          </div>
        </header>

        <main className="flex-1 px-4 pb-6 sm:px-6 lg:px-8">
          <div className="min-w-0">
            <AppBreadcrumbs />
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
