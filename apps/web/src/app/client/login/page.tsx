"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { ApiFetchError, apiFetch } from "@/lib/api-fetch";

export default function ClientLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await apiFetch.post("/api/auth/client-login", { email, password });
      router.push("/client");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiFetchError
          ? err.message
          : "Something went wrong. Please try again."
      );
      setLoading(false);
    }
  }

  return (
    <div className="app-shell flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.18),transparent_34%)]" />
      <div className="pointer-events-none absolute left-[9%] top-[16%] h-12 w-12 rotate-12 rounded-xl bg-sky-100/70" />
      <div className="pointer-events-none absolute right-[11%] top-[20%] h-11 w-11 -rotate-12 rounded-xl bg-cyan-100/70" />
      <div className="relative grid w-full max-w-6xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.12)] md:grid-cols-[1.05fr_0.95fr]">
        <aside className="hidden bg-[linear-gradient(160deg,#0f172a_0%,#0b1f3a_55%,#0f3d67_100%)] p-10 text-slate-50 md:flex md:flex-col md:justify-between">
          <div>
            <div className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-100">
              Operations platform
            </div>
            <h2 className="mt-6 text-5xl font-semibold tracking-tight">AsbaTechs CRM</h2>
            <p className="mt-5 max-w-lg text-sm leading-7 text-slate-200">
              Centralized attendance, lead operations, and sales reporting for teams that need
              clarity, speed, and trustworthy operational data.
            </p>
          </div>
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-100/90">
                Built for teams
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-100">
                A cleaner workspace for monitoring activity, reviewing pipeline health, and keeping
                internal workflows aligned.
              </p>
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-300/95">
              Professional internal software for daily operations
            </p>
          </div>
        </aside>

        <section className="p-7 sm:p-8">
          <div className="mb-8">
            <div className="mx-auto flex max-w-sm items-center gap-2 rounded-full bg-slate-100 p-1 text-xs font-semibold">
              <Link
                href="/login"
                className="flex-1 rounded-full px-4 py-2 text-center text-slate-500 transition hover:text-slate-700"
              >
                Employee Portal
              </Link>
              <Link
                href="/client/login"
                className="flex-1 rounded-full bg-white px-4 py-2 text-center text-sky-700 shadow-sm"
              >
                Client Portal
              </Link>
            </div>
          </div>

          <h1 className="text-center text-3xl font-semibold tracking-tight text-slate-900">Login to Portal</h1>

          {error && (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input w-full bg-white"
                placeholder="email@example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700">Password</label>
                <Link href="/forgot-password" className="text-sm font-medium text-sky-700 hover:text-sky-800">
                  Forgot?
                </Link>
              </div>
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input w-full bg-white"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Login"}
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs text-slate-400">or</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <button
            type="button"
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Continue with Google
          </button>
        </section>
      </div>
    </div>
  );
}
