import { Sparkles } from "lucide-react";

import { ATTENDANCE_TIME_ZONE } from "@/lib/attendance-date";
import { isAdminRole, isManagerRole } from "@/lib/rbac";

export type WorkspaceWelcomeProfile = {
  firstName: string;
  departmentName: string | null;
};

function getTimeGreeting(): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: ATTENDANCE_TIME_ZONE,
      hour: "numeric",
      hour12: false
    }).format(new Date())
  );
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatRoleLabel(role: string): string {
  const normalized = role.trim().toLowerCase();
  if (normalized === "admin") return "Administrator";
  if (normalized === "manager") return "Manager";
  if (normalized === "employee") return "Employee";
  return role;
}

function subtitleForRole(role: string): string {
  if (isAdminRole(role)) {
    return "Your command center for leads, live attendance, and team oversight — everything in one place.";
  }
  if (isManagerRole(role)) {
    return "Welcome to your workspace — review leads, attendance, and team activity with clarity.";
  }
  return "Welcome to AsbaTechs CRM — clock in, track your day, and stay aligned with your team.";
}

type Props = {
  profile: WorkspaceWelcomeProfile;
  role: string;
  /** `header` = compact sticky bar; `main` = large hero below breadcrumbs */
  variant?: "header" | "main";
};

export function WorkspaceWelcomeBanner({ profile, role, variant = "main" }: Props) {
  const greeting = getTimeGreeting();
  const firstName = profile.firstName.trim() || "there";
  const roleLabel = formatRoleLabel(role);
  const department = profile.departmentName?.trim();

  if (variant === "header") {
    return (
      <div className="min-w-0">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-600 dark:text-sky-300">
          AsbaTechs CRM
        </p>
        <p className="mt-1 font-[var(--font-display)] text-xl font-semibold leading-tight tracking-tight text-slate-950 dark:text-white sm:text-2xl">
          Welcome to{" "}
          <span className="text-sky-700 dark:text-sky-300">CRM workspace</span>
        </p>
      </div>
    );
  }

  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-sky-200/90 bg-gradient-to-r from-sky-50/95 via-white to-cyan-50/70 px-5 py-5 shadow-sm dark:border-sky-800/50 dark:from-sky-950/35 dark:via-slate-950 dark:to-cyan-950/20 sm:rounded-3xl sm:px-7 sm:py-6"
      aria-label="Workspace welcome"
    >
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-sky-400/15 blur-3xl dark:bg-sky-500/10"
        aria-hidden
      />
      <div className="relative flex items-start gap-4">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-sky-200/80 bg-white text-sky-600 shadow-sm dark:border-sky-800/60 dark:bg-sky-950/50 dark:text-sky-300 sm:h-14 sm:w-14"
          aria-hidden
        >
          <Sparkles className="h-6 w-6 sm:h-7 sm:w-7" />
        </div>
        <div className="min-w-0 flex-1">
          <h1
            className="font-[var(--font-display)] text-[1.875rem] font-semibold leading-tight tracking-tight text-slate-950 dark:text-white sm:text-4xl lg:text-[2.75rem]"
          >
            {greeting},{" "}
            <span className="text-sky-700 dark:text-sky-300">{firstName}</span>
          </h1>
          <p className="mt-3 max-w-3xl text-base leading-relaxed text-slate-600 dark:text-slate-300 sm:text-lg">
            {subtitleForRole(role)}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-slate-200/90 bg-white/95 px-3.5 py-1.5 text-sm font-semibold text-slate-800 shadow-sm dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100">
              {roleLabel}
            </span>
            {department ? (
              <span className="inline-flex items-center rounded-full border border-sky-200/80 bg-sky-50/95 px-3.5 py-1.5 text-sm font-semibold text-sky-800 dark:border-sky-800/60 dark:bg-sky-950/50 dark:text-sky-200">
                {department}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
