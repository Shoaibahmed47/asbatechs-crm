import type { ReactNode } from "react";
import "@/app/globals.css";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50">
        <div className="flex min-h-screen">
          <aside className="hidden w-64 border-r border-slate-200 bg-white px-4 py-6 md:block">
            <div className="mb-8">
              <div className="text-lg font-semibold text-slate-900">
                AsbaTechs CRM
              </div>
              <div className="text-xs text-slate-500">
                Internal operations console
              </div>
            </div>
            <nav className="space-y-4 text-sm">
              <div>
                <div className="mb-1 text-xs font-semibold uppercase text-slate-500">
                  Overview
                </div>
                <ul className="space-y-1">
                  <li>
                    <a href="/dashboard" className="block rounded-md px-2 py-1.5 text-slate-700 hover:bg-slate-100">
                      Dashboard
                    </a>
                  </li>
                </ul>
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold uppercase text-slate-500">
                  Work
                </div>
                <ul className="space-y-1">
                  <li>
                    <a href="/leads/hot" className="block rounded-md px-2 py-1.5 text-slate-700 hover:bg-slate-100">
                      Hot leads
                    </a>
                  </li>
                  <li>
                    <a href="/leads/sales" className="block rounded-md px-2 py-1.5 text-slate-700 hover:bg-slate-100">
                      Sales leads
                    </a>
                  </li>
                  <li>
                    <a href="/attendance" className="block rounded-md px-2 py-1.5 text-slate-700 hover:bg-slate-100">
                      Attendance
                    </a>
                  </li>
                </ul>
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold uppercase text-slate-500">
                  Admin
                </div>
                <ul className="space-y-1">
                  <li>
                    <a href="/users" className="block rounded-md px-2 py-1.5 text-slate-700 hover:bg-slate-100">
                      Users
                    </a>
                  </li>
                  <li>
                    <a href="/settings/departments" className="block rounded-md px-2 py-1.5 text-slate-700 hover:bg-slate-100">
                      Departments
                    </a>
                  </li>
                  <li>
                    <a href="/admin/overview" className="block rounded-md px-2 py-1.5 text-slate-700 hover:bg-slate-100">
                      Admin overview
                    </a>
                  </li>
                </ul>
              </div>
            </nav>
          </aside>
          <div className="flex min-h-screen flex-1 flex-col">
            <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
              <div>
                <div className="text-sm font-medium text-slate-900">
                  CRM Dashboard
                </div>
                <div className="text-xs text-slate-500">
                  Monitor attendance, leads, and sales performance.
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <div className="hidden flex-col text-right md:flex">
                  <span className="font-medium text-slate-900">
                    Current user
                  </span>
                  <span className="text-slate-500">Department · Role</span>
                </div>
                <div className="h-8 w-8 rounded-full bg-slate-200" />
              </div>
            </header>
            <main className="flex-1 bg-slate-50 px-6 py-6">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}

