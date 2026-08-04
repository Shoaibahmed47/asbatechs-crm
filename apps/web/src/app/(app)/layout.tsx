import type { ReactNode } from "react";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { AppBreadcrumbs } from "@/components/AppBreadcrumbs";
import { AppHeaderUser } from "@/components/AppHeader";
import { AppMobileNav } from "@/components/AppMobileNav";
import { AppSidebarNav } from "@/components/AppSidebarNav";
import { BodyPointerEventsGuard } from "@/components/BodyPointerEventsGuard";
import { DailyFocusCard } from "@/components/DailyFocusCard";
import {
  WorkspaceWelcomeBanner
} from "@/components/WorkspaceWelcomeBanner";
import { COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { getWorkspaceWelcomeProfile } from "@/lib/workspace-welcome";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const session = token ? await verifyAuthToken(token) : null;
  const welcomeProfile = session
    ? await getWorkspaceWelcomeProfile(session.userId)
    : null;

  return (
    <div className="app-shell overflow-x-hidden">
      <Suspense fallback={null}>
        <BodyPointerEventsGuard />
      </Suspense>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,color-mix(in_srgb,var(--brand-teal-light)_14%,transparent),transparent_28%),radial-gradient(circle_at_right,color-mix(in_srgb,var(--brand-orange)_10%,transparent),transparent_24%)]" />
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[264px] p-3 xl:block 2xl:w-[288px] 2xl:p-4">
        <div className="app-panel surface-reveal flex h-full min-h-0 flex-col overflow-hidden rounded-[22px] px-3 py-3.5 2xl:rounded-[26px] 2xl:px-4 2xl:py-4">
          <div className="shrink-0 border-b border-[color-mix(in_srgb,var(--brand-teal-light)_18%,transparent)] pb-3 dark:border-slate-800/80">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand-teal-light)] dark:text-[var(--brand-teal)]">
              AsbaTechs
            </div>
            <div className="mt-1 font-[var(--font-display)] text-lg font-semibold leading-tight tracking-tight text-slate-950 dark:text-white 2xl:text-xl">
              CRM Workspace
            </div>
            <p className="mt-1 text-xs leading-snug text-slate-500 dark:text-slate-400">
              Leads · attendance · team ops
            </p>
          </div>

          <AppSidebarNav userRole={session?.role} />

          <div className="mt-2 shrink-0 border-t border-[color-mix(in_srgb,var(--brand-teal-light)_14%,transparent)] pt-2 dark:border-slate-800/80">
            <DailyFocusCard />
          </div>
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-col xl:ml-[264px] 2xl:ml-[288px]">
        <header className="sticky top-0 z-10 px-3 pb-2 pt-3 sm:px-4 xl:px-5 2xl:px-6">
          <div className="app-panel surface-reveal flex flex-col gap-2.5 rounded-[18px] px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-3.5 2xl:rounded-[22px] 2xl:px-5 2xl:py-4">
            <div className="min-w-0 flex-1">
              <div className="mb-2 xl:hidden">
                <AppMobileNav userRole={session?.role} />
              </div>
              {welcomeProfile && session ? (
                <WorkspaceWelcomeBanner
                  profile={welcomeProfile}
                  role={session.role}
                  variant="header"
                />
              ) : (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                    AsbaTechs CRM
                  </div>
                  <div className="mt-0.5 font-[var(--font-display)] text-lg font-semibold leading-tight tracking-tight text-slate-950 dark:text-white sm:text-xl">
                    Internal workspace
                  </div>
                </div>
              )}
            </div>
            <AppHeaderUser />
          </div>
        </header>

        <main className="portal-scroll flex-1 px-3 pb-5 text-sm leading-relaxed sm:px-4 xl:px-5 2xl:px-6">
          <div className="surface-reveal min-w-0">
            <AppBreadcrumbs />
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
