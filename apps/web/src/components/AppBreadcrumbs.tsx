"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";

type Crumb = { label: string; href?: string };

const ROUTE_CRUMBS: Record<string, Crumb[]> = {
  "/dashboard": [{ label: "Executive dashboard" }],
  "/leads": [
    { label: "Operations", href: "/leads/hot" },
    { label: "All leads" }
  ],
  "/leads/hot": [
    { label: "Operations", href: "/leads/sales" },
    { label: "Hot leads" }
  ],
  "/leads/sales": [
    { label: "Operations", href: "/leads/hot" },
    { label: "Sales leads" }
  ],
  "/attendance": [{ label: "Attendance" }],
  "/attendance/report": [
    { label: "Attendance" },
    { label: "Daily report" }
  ],
  "/users": [{ label: "Employees" }],
  "/settings/departments": [
    { label: "Administration", href: "/users" },
    { label: "Departments" }
  ],
  "/settings/clients": [
    { label: "Administration", href: "/users" },
    { label: "Clients" }
  ],
  "/admin/overview": [
    { label: "Administration", href: "/users" },
    { label: "Admin control" }
  ]
};

export function AppBreadcrumbs() {
  const pathname = usePathname() || "";
  const crumbs = ROUTE_CRUMBS[pathname];
  if (!crumbs?.length) return null;

  const isDashboard = pathname === "/dashboard";
  const isCompact = !isDashboard && crumbs.length === 1;

  return (
    <nav className={isCompact ? "mb-4" : "mb-6"} aria-label="Breadcrumb">
      <div
        className={
          isCompact
            ? "flex flex-wrap items-center gap-2 rounded-xl border border-slate-200/90 bg-white/90 px-3 py-2 shadow-sm backdrop-blur-xl dark:border-slate-700/90 dark:bg-slate-950/70"
            : "flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200/90 bg-gradient-to-r from-white/90 via-white/75 to-slate-50/40 px-4 py-3 shadow-[0_8px_30px_rgba(15,23,42,0.06)] backdrop-blur-xl dark:border-slate-700/90 dark:from-slate-950/80 dark:via-slate-950/70 dark:to-slate-900/40 dark:shadow-[0_8px_32px_rgba(0,0,0,0.35)]"
        }
      >
        <Link
          href="/dashboard"
          className={
            isCompact
              ? "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200/80 bg-white text-slate-600 shadow-sm transition hover:border-sky-300 hover:text-sky-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-sky-600 dark:hover:text-sky-400"
              : "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200/80 bg-white text-slate-600 shadow-sm transition hover:border-sky-300 hover:text-sky-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-sky-600 dark:hover:text-sky-400"
          }
          aria-label="Executive dashboard"
        >
          <Home className="h-4 w-4" strokeWidth={2} />
        </Link>

        {!isDashboard ? (
          <>
            <ChevronRight
              className="h-4 w-4 shrink-0 text-slate-300 dark:text-slate-600"
              aria-hidden
            />
            <ol className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1 gap-y-1">
              {crumbs.map((crumb, i) => {
                const isLast = i === crumbs.length - 1;
                return (
                  <li key={`${crumb.label}-${i}`} className="flex items-center gap-1">
                    {i > 0 ? (
                      <ChevronRight
                        className="mx-0.5 h-4 w-4 shrink-0 text-slate-300 dark:text-slate-600"
                        aria-hidden
                      />
                    ) : null}
                    {crumb.href && !isLast ? (
                      <Link
                        href={crumb.href}
                        className="rounded-lg px-2.5 py-1.5 text-base font-medium text-slate-600 transition hover:bg-sky-50 hover:text-sky-700 dark:text-slate-400 dark:hover:bg-sky-950/50 dark:hover:text-sky-300"
                      >
                        {crumb.label}
                      </Link>
                    ) : (
                      <span
                        className={
                          isLast
                            ? isCompact
                              ? "text-base font-semibold tracking-tight text-slate-900 dark:text-white"
                              : "rounded-lg bg-gradient-to-r from-sky-600/12 to-cyan-600/10 px-3 py-1.5 text-base font-semibold tracking-tight text-slate-900 dark:from-sky-400/15 dark:to-cyan-400/10 dark:text-white"
                            : "px-2.5 py-1.5 text-base font-medium text-slate-500 dark:text-slate-400"
                        }
                        aria-current={isLast ? "page" : undefined}
                      >
                        {crumb.label}
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          </>
        ) : (
          <span className="text-base font-semibold tracking-tight text-slate-800 dark:text-slate-100">
            Executive dashboard
          </span>
        )}
      </div>
    </nav>
  );
}
