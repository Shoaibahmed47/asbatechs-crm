import type { ReactNode } from "react";
import { AppHeaderUser } from "@/components/AppHeader";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 overflow-y-auto border-r border-slate-200 bg-white px-4 py-6 dark:border-slate-800 dark:bg-slate-900 md:block">
        <div className="mb-8">
          <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            AsbaTechs CRM
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Internal operations console
          </div>
        </div>
        <nav className="space-y-4 text-sm">
          <div>
            <div className="mb-1 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
              Overview
            </div>
            <ul className="space-y-1">
              <li>
                <a href="/dashboard" className="block rounded-md px-2 py-1.5 text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
                  Dashboard
                </a>
              </li>
            </ul>
          </div>
          <div>
            <div className="mb-1 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
              Work
            </div>
            <ul className="space-y-1">
              <li>
                <a href="/leads/hot" className="block rounded-md px-2 py-1.5 text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
                  Hot leads
                </a>
              </li>
              <li>
                <a href="/leads/sales" className="block rounded-md px-2 py-1.5 text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
                  Sales leads
                </a>
              </li>
              <li>
                <a href="/attendance" className="block rounded-md px-2 py-1.5 text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
                  Attendance
                </a>
              </li>
            </ul>
          </div>
          <div>
            <div className="mb-1 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
              Admin
            </div>
            <ul className="space-y-1">
              <li>
                <a href="/users" className="block rounded-md px-2 py-1.5 text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
                  Employee
                </a>
              </li>
              <li>
                <a href="/settings/departments" className="block rounded-md px-2 py-1.5 text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
                  Departments
                </a>
              </li>
              <li>
                <a href="/admin/overview" className="block rounded-md px-2 py-1.5 text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
                  Admin control
                </a>
              </li>
            </ul>
          </div>
        </nav>
      </aside>
      <div className="flex h-screen min-w-0 flex-col md:ml-64">
        <header className="shrink-0 border-b border-slate-200 bg-white px-6 py-3 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
              CRM Dashboard
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Monitor attendance, leads, and sales performance.
            </div>
          </div>
          <AppHeaderUser />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto bg-slate-50 px-6 py-6 dark:bg-slate-950">
          {children}
        </main>
      </div>
    </div>
  );
}

