import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getClientSession } from "@/lib/client-session";
import { BodyPointerEventsGuard } from "@/components/BodyPointerEventsGuard";
import { ClientPortalLogout } from "@/components/ClientPortalLogout";

const nav = [
  { href: "/client", label: "Dashboard" },
  { href: "/client/projects", label: "Projects" },
  { href: "/client/work", label: "Work updates" },
  { href: "/client/profile", label: "Profile" }
] as const;

export default async function ClientPortalLayout({ children }: { children: ReactNode }) {
  const session = await getClientSession();
  if (!session) {
    redirect("/client/login");
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <BodyPointerEventsGuard />
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-400">
              AsbaTechs
            </div>
            <p className="text-sm font-medium text-white">Client portal</p>
          </div>
          <nav className="flex flex-wrap items-center gap-1">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-1.5 text-sm text-slate-300 transition hover:bg-slate-800 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
            <ClientPortalLogout />
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
