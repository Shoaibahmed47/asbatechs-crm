"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { ApiFetchError, apiFetch } from "@/lib/api-fetch";

export default function ClientSignupPage() {
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const token = params?.token ?? "";
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!token) {
      setError("Invalid invitation.");
      return;
    }
    setLoading(true);
    try {
      await apiFetch.post("/api/auth/client-signup", {
        token,
        password,
        name: name.trim() || undefined
      });
      router.push("/client/login");
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
              <span className="flex-1 rounded-full bg-white px-4 py-2 text-center text-sky-700 shadow-sm">
                Client Portal
              </span>
            </div>
          </div>

          <h1 className="text-center text-3xl font-semibold tracking-tight text-slate-900">
            Complete client signup
          </h1>
          <p className="mt-2 text-center text-sm text-slate-500">
            Set your name and password, then sign in on the next page.
          </p>
          {error && (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Display name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="form-input w-full bg-white"
                placeholder="Your name or company"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Password</label>
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input w-full bg-white"
                required
                minLength={8}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Confirm password</label>
              <PasswordInput
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="form-input w-full bg-white"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Saving..." : "Create account"}
            </Button>
          </form>
          <p className="mt-5 text-center text-xs text-slate-500">
            <Link href="/client/login" className="font-medium text-sky-700 hover:text-sky-800">
              Back to client sign in
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
