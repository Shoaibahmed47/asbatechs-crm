import type { ReactNode } from "react";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { AppShell } from "@/components/AppShell";
import { BodyPointerEventsGuard } from "@/components/BodyPointerEventsGuard";
import { COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { getWorkspaceWelcomeProfile } from "@/lib/workspace-welcome";

/**
 * Staff app shell — collapsible AppleLayout-style rail + frosted top bar.
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

      <AppShell userRole={session?.role} welcomeProfile={welcomeProfile}>
        {children}
      </AppShell>
    </div>
  );
}
