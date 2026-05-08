import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { AppBreadcrumbs } from "@/components/AppBreadcrumbs";
import { AppHeaderUser } from "@/components/AppHeader";
import { AppMobileNav } from "@/components/AppMobileNav";
import { AppSidebarNav } from "@/components/AppSidebarNav";
import { BodyPointerEventsGuard } from "@/components/BodyPointerEventsGuard";
import { DailyFocusCard } from "@/components/DailyFocusCard";
import { COOKIE_NAME, verifyAuthToken } from "@/lib/auth";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const session = token ? await verifyAuthToken(token) : null;

  return (
    <div className="app-shell overflow-x-hidden">
      <BodyPointerEventsGuard />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.1),transparent_28%),radial-gradient(circle_at_right,rgba(6,182,212,0.08),transparent_24%)]" />
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[304px] p-5 xl:block">
        <div className="app-panel surface-reveal flex h-full min-h-0 flex-col overflow-hidden rounded-[30px] px-5 py-6">
          <div className="shrink-0 border-b border-slate-200/70 pb-6 dark:border-slate-800/80">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-600 dark:text-sky-300">
              AsbaTechs
            </div>
            <div className="mt-3 font-[var(--font-display)] text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
              CRM Workspace
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
              Operational oversight for leads, attendance, and internal team management.
            </p>
          </div>

          <AppSidebarNav userRole={session?.role} />

          <div className="mt-4 shrink-0 border-t border-slate-200/60 pt-4 dark:border-slate-800/80">
            <DailyFocusCard />
          </div>
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-col xl:ml-[304px]">
        <header className="sticky top-0 z-10 px-4 pb-3 pt-4 sm:px-6 xl:px-8">
          <div className="app-panel surface-reveal flex flex-col gap-4 rounded-[24px] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-3 lg:hidden">
                <AppMobileNav userRole={session?.role} />
              </div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                Internal operations command center
              </div>
              <div className="mt-2 font-[var(--font-display)] text-xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-2xl">
                Professional team workflow management
              </div>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Clear sales visibility, attendance tracking, and admin oversight from one focused workspace.
              </p>
            </div>
            <AppHeaderUser />
          </div>
        </header>

        <main className="flex-1 px-4 pb-6 sm:px-6 xl:px-8">
          <div className="surface-reveal min-w-0">
            <AppBreadcrumbs />
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
