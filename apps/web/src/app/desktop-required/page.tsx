import Link from "next/link";

export default function DesktopRequiredPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-6 py-16">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-sky-600">
          AsbaTechs CRM
        </p>
        <h1 className="mt-2 font-[var(--font-display)] text-3xl font-semibold text-slate-950 dark:text-white">
          Employees must use the desktop app
        </h1>
        <p className="mt-3 text-base leading-relaxed text-slate-600 dark:text-slate-400">
          Employee attendance is monitored from the AsbaTechs CRM desktop app so laptop lock,
          sleep, resume, and activity signals are captured consistently. Browser access remains
          available for admins and managers.
        </p>
      </div>

      <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-base leading-relaxed text-sky-900 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-200">
        Install or open the desktop app, then sign in with your CRM email and password. Keep it
        running in the system tray while your shift is open.
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/download/desktop"
          className="inline-flex items-center justify-center rounded-xl bg-sky-600 px-5 py-3 text-base font-semibold text-white hover:bg-sky-700"
        >
          Download desktop app
        </Link>
      </div>
    </main>
  );
}