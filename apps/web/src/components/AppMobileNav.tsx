"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ChevronDown, Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { filterNavItems, navSections } from "@/components/AppSidebarNav";

type AppMobileNavProps = {
  userRole?: string | null;
};

export function AppMobileNav({ userRole }: AppMobileNavProps) {
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    Overview: true,
    Operations: true,
    Administration: true
  });
  const pathname = usePathname();
  const role = userRole ?? undefined;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isOpen) return;
    setOpenSections({
      Overview: true,
      Operations: true,
      Administration: true
    });
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        className="inline-flex items-center justify-center rounded-xl border border-slate-200/80 bg-white/80 p-2.5 text-slate-700 shadow-sm transition hover:bg-slate-100 dark:border-slate-700/80 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800 xl:hidden"
        onClick={() => setIsOpen(true)}
        aria-label="Open navigation menu"
      >
        <Menu className="h-4 w-4" />
      </button>

      {isOpen && mounted
        ? createPortal(
            <div className="fixed inset-0 z-40 xl:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/45 backdrop-blur-[1px]"
            aria-label="Close navigation menu overlay"
            onClick={() => setIsOpen(false)}
          />

          <aside className="app-panel drawer-enter-left absolute inset-y-0 left-0 z-10 flex h-full w-[92vw] max-w-[380px] flex-col overflow-hidden border-r border-slate-200 p-4 shadow-2xl dark:border-slate-800">
            <div className="mb-4 flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 pb-4 dark:border-slate-800">
              <div>
                <div className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-600 dark:text-sky-300">
                  AsbaTechs
                </div>
                <div className="mt-2 font-[var(--font-display)] text-lg font-semibold tracking-tight text-slate-950 dark:text-white">
                  CRM Workspace
                </div>
              </div>
              <button
                type="button"
                className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                onClick={() => setIsOpen(false)}
                aria-label="Close navigation menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col">
              <nav
                className="mt-1 min-h-0 flex-1 space-y-4 overflow-x-hidden overflow-y-auto overscroll-contain pb-3 pr-1"
                aria-label="Mobile navigation"
              >
                {navSections.map((section) => {
                  const items = filterNavItems(section.items, role);
                  if (items.length === 0) return null;

                  const isExpanded = openSections[section.label] ?? true;

                  return (
                    <div key={section.label} className="rounded-xl border border-slate-200/80 dark:border-slate-800/80">
                      <button
                        type="button"
                        className="flex w-full items-center justify-between rounded-xl px-3.5 py-3 text-left text-base font-semibold text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                        aria-expanded={isExpanded}
                        onClick={() =>
                          setOpenSections((prev) => ({
                            ...prev,
                            [section.label]: !isExpanded
                          }))
                        }
                      >
                        <span>{section.label}</span>
                        <ChevronDown
                          className={`h-4 w-4 text-slate-500 transition-transform dark:text-slate-400 ${
                            isExpanded ? "rotate-180" : ""
                          }`}
                        />
                      </button>

                      {isExpanded ? (
                        <div className="space-y-1.5 px-2 pb-2">
                          {items.map((item) => {
                            const active =
                              pathname === item.href ||
                              (item.href !== "/dashboard" &&
                                item.href !== "/attendance" &&
                                pathname.startsWith(`${item.href}/`));

                            return (
                              <Link
                                key={item.href}
                                href={item.href}
                                className={`app-nav-link ${active ? "app-nav-link-active" : ""}`}
                              >
                                {item.icon ? (
                                  <item.icon className="h-5 w-5 opacity-80" />
                                ) : (
                                  <span className="h-2 w-2 rounded-full bg-current opacity-60" />
                                )}
                                <span>{item.label}</span>
                              </Link>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </nav>
            </div>
          </aside>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
