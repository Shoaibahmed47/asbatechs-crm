import Link from "next/link";

const installerUrl =
  process.env.NEXT_PUBLIC_DESKTOP_INSTALLER_URL?.trim() ||
  process.env.DESKTOP_INSTALLER_URL?.trim() ||
  "";

export default function DesktopDownloadPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-6 py-16">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-sky-600">
          AsbaTechs CRM
        </p>
        <h1 className="mt-2 font-[var(--font-display)] text-3xl font-semibold text-slate-950 dark:text-white">
          Desktop app download
        </h1>
        <p className="mt-3 text-base leading-relaxed text-slate-600 dark:text-slate-400">
          Install the AsbaTechs CRM desktop application once per Windows laptop. It includes
          built-in attendance monitoring — no separate agent or PowerShell setup required.
        </p>
      </div>

      <ol className="list-decimal space-y-2 pl-5 text-base text-slate-700 dark:text-slate-300">
        <li>Download and run the installer below.</li>
        <li>Sign in with your CRM email and password.</li>
        <li>Keep the app running in the system tray during shifts.</li>
      </ol>

      {installerUrl ? (
        <a
          href={installerUrl}
          className="inline-flex w-fit items-center justify-center rounded-xl bg-sky-600 px-5 py-3 text-base font-semibold text-white hover:bg-sky-700"
        >
          Download AsbaTechs CRM for Windows
        </a>
      ) : (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          Installer URL is not configured yet. Ask IT to set{" "}
          <code className="font-mono">NEXT_PUBLIC_DESKTOP_INSTALLER_URL</code> or publish the
          Electron build from <code className="font-mono">apps/desktop</code>.
        </p>
      )}

      <p className="text-sm text-slate-500 dark:text-slate-400">
        IT teams: see <code className="font-mono">docs/desktop-app-deployment.md</code> in the
        repository for silent install (<code className="font-mono">/S</code>), updates, and env
        vars. Admins can copy the app link from the attendance report table.
      </p>

      <p className="text-sm text-slate-500 dark:text-slate-400">
        <Link href="/login" className="font-medium text-sky-600 hover:underline">
          Back to staff login
        </Link>
      </p>
    </main>
  );
}
