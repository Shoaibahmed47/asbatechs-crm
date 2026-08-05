import Link from "next/link";
import { headers } from "next/headers";

import { DESKTOP_INSTALLER_DOWNLOAD_URL } from "@/lib/desktop-installer-url";

/** Never static-prerender this page (old empty installer HTML was stuck on CDN). */
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

function getInstallerUrl(): string {
  return (
    process.env.NEXT_PUBLIC_DESKTOP_INSTALLER_URL?.trim() ||
    process.env.DESKTOP_INSTALLER_URL?.trim() ||
    DESKTOP_INSTALLER_DOWNLOAD_URL
  );
}

export default async function DesktopDownloadPage() {
  await headers();
  const installerUrl = getInstallerUrl();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-6 py-16">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-600">
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

      <a
        href={installerUrl}
        className="inline-flex w-fit items-center justify-center rounded-xl bg-[var(--brand-teal-light)] px-5 py-3 text-base font-semibold text-white hover:bg-[var(--brand-teal)]"
      >
        Download AsbaTechs CRM for Windows
      </a>

      <p className="text-xs text-slate-400 dark:text-slate-500" data-deploy-marker="desktop-dl-v4">
        Or open Releases if the button fails:{" "}
        <a
          className="font-medium text-brand-600 hover:underline"
          href="https://github.com/Shoaibahmed47/asbatechs-crm/releases/latest"
          target="_blank"
          rel="noreferrer"
        >
          GitHub Releases
        </a>
      </p>

      <p className="text-sm text-slate-500 dark:text-slate-400">
        IT teams: see <code className="font-mono">docs/desktop-app-deployment.md</code> in the
        repository for silent install (<code className="font-mono">/S</code>), updates, and env
        vars. Admins can copy the app link from the attendance report table.
      </p>

      <p className="text-sm text-slate-500 dark:text-slate-400">
        <Link href="/login" className="font-medium text-brand-600 hover:underline">
          Back to staff login
        </Link>
      </p>
    </main>
  );
}
