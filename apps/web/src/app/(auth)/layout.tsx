import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2">
          <div className="hidden bg-slate-900 p-8 text-slate-50 md:flex md:flex-col md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold">AsbaTechs CRM</h1>
              <p className="mt-2 text-sm text-slate-200">
                Internal CRM to manage attendance, leads, and sales
                performance across all departments.
              </p>
            </div>
            <p className="mt-8 text-xs text-slate-300">
              Designed for productivity and clarity in high-volume sales
              environments.
            </p>
          </div>
          <div className="bg-white p-8">{children}</div>
        </div>
      </div>
    </div>
  );
}

