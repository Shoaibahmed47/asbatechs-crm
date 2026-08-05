"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, PanelLeft } from "lucide-react";
import { AppBreadcrumbs } from "@/components/AppBreadcrumbs";
import { AppHeaderUser } from "@/components/AppHeader";
import { AppMobileNav } from "@/components/AppMobileNav";
import { AppSidebarNav } from "@/components/AppSidebarNav";
import { BrandMark } from "@/components/BrandMark";
import { DailyFocusCard } from "@/components/DailyFocusCard";
import {
  WorkspaceWelcomeBanner,
  type WorkspaceWelcomeProfile
} from "@/components/WorkspaceWelcomeBanner";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "crm-sidebar-collapsed";

type AppShellProps = {
  children: ReactNode;
  userRole?: string | null;
  welcomeProfile?: WorkspaceWelcomeProfile | null;
};

/**
 * Staff shell with collapsible desktop sidebar.
 * Expanded 260px / collapsed 72px; preference stored in localStorage.
 */
export function AppShell({ children, userRole, welcomeProfile }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const isCollapsed = hydrated && collapsed;
  const sidebarWidthClass = isCollapsed ? "w-[72px]" : "w-[260px] 2xl:w-[280px]";
  const mainMarginClass = isCollapsed ? "xl:ml-[72px]" : "xl:ml-[260px] 2xl:ml-[280px]";

  return (
    <>
      <aside
        className={cn(
          "apple-sidebar fixed inset-y-0 left-0 z-20 hidden flex-col xl:flex",
          "transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[width]",
          sidebarWidthClass
        )}
        aria-label="Primary"
        data-collapsed={isCollapsed ? "true" : "false"}
        data-testid="app-sidebar-rail"
      >
        <div
          className={cn(
            "flex shrink-0 items-center border-b border-black/[0.04] dark:border-white/[0.06]",
            isCollapsed ? "flex-col gap-2 px-2 py-3" : "gap-2 px-3 py-3"
          )}
        >
          <div
            className={cn(
              "flex min-w-0 items-center",
              isCollapsed ? "justify-center" : "flex-1 gap-2.5"
            )}
          >
            <BrandMark size={isCollapsed ? 32 : 36} className="rounded-full shadow-sm" />
            {!isCollapsed ? (
              <div className="min-w-0">
                <div className="truncate text-[13px] font-semibold tracking-tight text-slate-950 dark:text-white">
                  AsbaTechs CRM
                </div>
                <div className="truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Workspace
                </div>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={toggleCollapsed}
            className={cn(
              "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-black/[0.06] bg-white/70 text-[var(--brand-fg)] shadow-sm transition",
              "hover:bg-[color-mix(in_srgb,var(--teal-60)_80%,white)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--brand-teal-light)_35%,transparent)]",
              "dark:border-white/10 dark:bg-slate-900/70 dark:hover:bg-slate-800"
            )}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!isCollapsed}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            data-testid="sidebar-collapse-toggle"
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" aria-hidden />
            ) : (
              <ChevronLeft className="h-4 w-4" aria-hidden />
            )}
          </button>
        </div>

        <AppSidebarNav userRole={userRole} collapsed={isCollapsed} />

        <div
          className={cn(
            "mt-auto shrink-0 border-t border-black/[0.04] dark:border-white/[0.06]",
            isCollapsed ? "p-2" : "p-3"
          )}
        >
          {isCollapsed ? (
            <div
              className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--teal-60)_88%,hsl(var(--card)))] text-[var(--brand-fg)] dark:bg-[color-mix(in_srgb,var(--teal-80)_55%,transparent)]"
              title="Daily focus: review leads, attendance, ownership"
            >
              <PanelLeft className="h-4 w-4" aria-hidden />
            </div>
          ) : (
            <DailyFocusCard />
          )}
        </div>
      </aside>

      <div
        className={cn(
          "apple-main flex min-h-screen min-w-0 flex-col transition-[margin-left] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          mainMarginClass
        )}
      >
        <header className="apple-topbar sticky top-0 z-10">
          <div className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-3 2xl:px-6">
            <div className="flex min-w-0 flex-1 items-start gap-2">
              <div className="xl:hidden">
                <AppMobileNav userRole={userRole} />
              </div>
              <button
                type="button"
                onClick={toggleCollapsed}
                className={cn(
                  "hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200/80 bg-white/85 text-[var(--brand-fg)] shadow-sm transition",
                  "hover:bg-[color-mix(in_srgb,var(--teal-60)_70%,white)] dark:border-slate-700 dark:bg-slate-900/85",
                  isCollapsed ? "xl:inline-flex" : "xl:hidden"
                )}
                aria-label="Expand sidebar"
                title="Expand sidebar"
                data-testid="sidebar-expand-header"
              >
                <PanelLeft className="h-4 w-4" />
              </button>

              <div className="min-w-0 flex-1">
                {welcomeProfile && userRole ? (
                  <WorkspaceWelcomeBanner
                    profile={welcomeProfile}
                    role={userRole}
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
    </>
  );
}
