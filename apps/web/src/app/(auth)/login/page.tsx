"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PasswordInput } from "@/components/ui/password-input";
import { ApiFetchError, apiFetch } from "@/lib/api-fetch";
import {
  clearDesktopSavedLogin,
  getDesktopSavedLogin,
  saveDesktopLogin
} from "@/lib/desktop-saved-login";
import { isElectronDesktop, notifyElectronSessionReady } from "@/lib/is-electron-desktop";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDesktopApp, setIsDesktopApp] = useState(false);
  const [savedLoginEmail, setSavedLoginEmail] = useState<string | null>(null);
  const [showSaveLoginDialog, setShowSaveLoginDialog] = useState(false);

  useEffect(() => {
    const desktop = isElectronDesktop();
    setIsDesktopApp(desktop);
    if (!desktop) return;

    void (async () => {
      const saved = await getDesktopSavedLogin();
      if (!saved) return;
      setEmail(saved.email);
      setPassword(saved.password);
      setSavedLoginEmail(saved.email);
    })();
  }, []);

  async function finishLoginNavigation(): Promise<void> {
    await notifyElectronSessionReady();
    router.push("/dashboard");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const data = await apiFetch.post<{ token?: string }>("/api/auth/login", {
        email,
        password
      });
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem("crm_auth_redirected");
        if (data?.token) {
          window.localStorage.setItem("crm_token", data.token);
        } else {
          window.localStorage.removeItem("crm_token");
          window.localStorage.removeItem("auth_token");
          window.localStorage.removeItem("token");
        }
      }

      if (isDesktopApp) {
        const saved = await getDesktopSavedLogin();
        const alreadySaved =
          saved?.email === email.trim() && saved.password === password;
        if (!alreadySaved) {
          setShowSaveLoginDialog(true);
          setLoading(false);
          return;
        }
      }

      await finishLoginNavigation();
    } catch (err) {
      let msg =
        err instanceof ApiFetchError ? err.message : "Something went wrong. Please try again.";
      if (
        err instanceof ApiFetchError &&
        err.details &&
        typeof err.details === "object" &&
        err.details !== null &&
        "detail" in err.details &&
        typeof (err.details as { detail?: unknown }).detail === "string"
      ) {
        msg += ` | ${(err.details as { detail: string }).detail}`;
      }
      setError(msg);
      setLoading(false);
    }
  }

  async function handleSaveLoginChoice(shouldSave: boolean): Promise<void> {
    setShowSaveLoginDialog(false);
    if (shouldSave) {
      const ok = await saveDesktopLogin(email, password);
      if (ok) {
        setSavedLoginEmail(email.trim());
      }
    }
    setLoading(true);
    try {
      await finishLoginNavigation();
    } catch {
      setLoading(false);
      setError("Signed in, but could not open the dashboard. Please try again.");
    }
  }

  async function handleForgetSavedLogin(): Promise<void> {
    await clearDesktopSavedLogin();
    setSavedLoginEmail(null);
    setPassword("");
  }

  return (
    <div className="app-shell flex min-h-screen items-center justify-center px-3 py-6 sm:px-4 sm:py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.16),transparent_36%)]" />
      <div className="pointer-events-none absolute left-[9%] top-[16%] h-12 w-12 rotate-12 rounded-xl bg-sky-100/70" />
      <div className="pointer-events-none absolute right-[11%] top-[20%] h-11 w-11 -rotate-12 rounded-xl bg-cyan-100/70" />

      <div className="surface-reveal relative grid w-full max-w-6xl overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 shadow-[0_24px_60px_rgba(15,23,42,0.15)] sm:rounded-3xl md:grid-cols-[1.05fr_0.95fr]">
        <aside className="hidden bg-[linear-gradient(160deg,#0f172a_0%,#0b1f3a_55%,#0f3d67_100%)] p-10 text-slate-50 md:flex md:flex-col md:justify-between">
          <div>
            <div className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm font-semibold uppercase tracking-[0.22em] text-sky-100">
              Operations platform
            </div>
            <h2 className="mt-6 font-[var(--font-display)] text-5xl font-semibold tracking-tight">AsbaTechs CRM</h2>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-slate-200">
              Centralized attendance, lead operations, and sales reporting for teams that need
              clarity, speed, and trusted operational data.
            </p>
          </div>
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-100/90">Built for teams</div>
              <p className="mt-3 text-base leading-relaxed text-slate-100">
                A cleaner workspace for monitoring activity, reviewing pipeline health, and keeping
                internal workflows aligned.
              </p>
            </div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-300/95">
              Professional internal software for daily operations
            </p>
          </div>
        </aside>

        <section className="p-5 sm:p-8 md:p-9">
          <div className="mb-6 sm:mb-8">
            <div className="mx-auto flex w-full max-w-sm items-center gap-1 rounded-full bg-slate-100 p-1 text-sm font-semibold sm:gap-2 sm:text-sm">
              <Link href="/login" className="flex-1 rounded-full bg-white px-2 py-2 text-center text-sky-700 shadow-sm sm:px-4">
                Employee Portal
              </Link>
              <Link
                href="/client/login"
                className="flex-1 rounded-full px-2 py-2 text-center text-slate-500 transition hover:text-slate-700 sm:px-4"
              >
                Client Portal
              </Link>
            </div>
          </div>

          <h1 className="text-center font-[var(--font-display)] text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Login to portal
          </h1>
          <p className="mt-2 text-center text-sm text-slate-500">Continue to your internal workspace.</p>

          {isDesktopApp && savedLoginEmail ? (
            <div className="mx-auto mt-5 max-w-md rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
              <p>
                Saved on this computer as <span className="font-semibold">{savedLoginEmail}</span>.
                Click Login to sign in without typing again.
              </p>
              <button
                type="button"
                className="mt-2 text-sm font-medium text-sky-800 underline underline-offset-2 hover:text-sky-950"
                onClick={() => void handleForgetSavedLogin()}
              >
                Remove saved login
              </button>
            </div>
          ) : null}

          {error ? (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          ) : null}

          <form className="mt-5 space-y-4 sm:mt-6 sm:space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="block text-base font-medium text-slate-700">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="auth-form-input"
                placeholder="email@example.com"
                autoComplete="email"
                required
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-base font-medium text-slate-700">Password</label>
                <Link href="/forgot-password" className="text-sm font-medium text-sky-700 hover:text-sky-800">
                  Forgot?
                </Link>
              </div>
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="auth-form-input"
                placeholder="Enter your password"
                autoComplete="current-password"
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : savedLoginEmail ? `Login as ${savedLoginEmail}` : "Login"}
            </Button>
          </form>
        </section>
      </div>

      <ConfirmDialog
        open={showSaveLoginDialog}
        title="Save login on this computer?"
        description="Next time you open the desktop app, your email and password will be filled automatically so you can sign in with one click."
        confirmLabel="Save"
        cancelLabel="Not now"
        onConfirm={() => void handleSaveLoginChoice(true)}
        onCancel={() => void handleSaveLoginChoice(false)}
      />
    </div>
  );
}
