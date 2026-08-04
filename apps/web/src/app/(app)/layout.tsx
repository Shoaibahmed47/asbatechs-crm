import type { ReactNode } from "react";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { AppBreadcrumbs } from "@/components/AppBreadcrumbs";
import { AppHeaderUser } from "@/components/AppHeader";
import { AppMobileNav } from "@/components/AppMobileNav";
import { AppSidebarNav } from "@/components/AppSidebarNav";
import { BodyPointerEventsGuard } from "@/components/BodyPointerEventsGuard";
import { BrandMark } from "@/components/BrandMark";
import { DailyFocusCard } from "@/components/DailyFocusCard";
import { WorkspaceWelcomeBanner } from "@/components/WorkspaceWelcomeBanner";
import { COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { getWorkspaceWelcomeProfile } from "@/lib/workspace-welcome";

/**
 * Staff app shell — AppleLayout-style rail + frosted top bar
 * (reference: allfiles.zip / AppleLayout.tsx → AppleSidebar wrapper pattern).
 */
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
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,color-mix(in_srgb,var(--brand-teal-light)_12%,transparent),transparent_30%),radial-gradient(circle_at_right,color-mix(in_srgb,var(--brand-orange)_8%,transparent),transparent_26%)]"
        aria-hidden
      />

      {/* Full-height glass rail (xl+) — edge-to-edge like AppleSidebar shells */}
      <aside
        className="apple-sidebar fixed inset-y-0 left-0 z-20 hidden w-[260px] xl:flex xl:flex-col 2xl:w-[280px]"
        aria-label="Primary"
      >
        <div className="apple-sidebar-brand shrink-0 border-b border-black/[0.04] dark:border-white/[0.06]">
          <BrandMark size={36} className="h-9 w-9 rounded-full shadow-sm" />
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold tracking-tight text-slate-950 dark:text-white">
              AsbaTechs CRM
            </div>
            <div className="truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Workspace
            </div>
          </div>
        </div>

        <AppSidebarNav userRole={session?.role} />

        <div className="mt-auto shrink-0 border-t border-black/[0.04] p-3 dark:border-white/[0.06]">
          <DailyFocusCard />
        </div>
      </aside>

      <div className="apple-main flex min-h-screen min-w-0 flex-col xl:ml-[260px] 2xl:ml-[280px]">
        <header className="apple-topbar sticky top-0 z-10">
          <div className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-3 2xl:px-6">
            <div className="min-w-0 flex-1">
              <div className="mb-1.5 xl:hidden">
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
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                    AsbaTechs CRM
                  </div>
                  <div className="mt-0.5 text-base font-semibold tracking-tight text-slate-950 dark:text-white sm:text-lg">
                    Internal workspace
                  </div>
                </div>
              )}
            </div>
            <AppHeaderUser />
          </div>
        </header>

        <main className="portal-scroll flex-1 px-3 pb-6 pt-3 text-sm leading-relaxed sm:px-5 sm:pt-4 2xl:px-6">
          <div className="surface-reveal mx-auto min-w-0 max-w-[1600px]">
            <AppBreadcrumbs />
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
