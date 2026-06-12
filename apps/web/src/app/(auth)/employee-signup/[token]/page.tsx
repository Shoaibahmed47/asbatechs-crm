"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { ApiFetchError, apiFetch } from "@/lib/api-fetch";

export default function EmployeeSignupPage() {
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const token = params?.token ?? "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!token) {
      setError("Invalid or missing invitation token.");
      return;
    }

    setLoading(true);
    try {
      await apiFetch.post("/api/auth/employee-signup", { token, password });
      router.push("/login");
    } catch (error) {
      setError(
        error instanceof ApiFetchError
          ? error.message
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
            <div className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm font-semibold uppercase tracking-[0.22em] text-sky-100">
              Operations platform
            </div>
            <h2 className="mt-6 text-5xl font-semibold tracking-tight">AsbaTechs CRM</h2>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-slate-200">
              Centralized attendance, lead operations, and sales reporting for teams that need
              clarity, speed, and trustworthy operational data.
            </p>
          </div>
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-100/90">
                Built for teams
              </div>
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

        <section className="p-7 sm:p-8">
          <div className="mb-8">
            <div className="mx-auto flex max-w-sm items-center gap-2 rounded-full bg-slate-100 p-1 text-sm font-semibold">
              <span className="flex-1 rounded-full bg-white px-4 py-2 text-center text-sky-700 shadow-sm">
                Employee Portal
              </span>
              <span className="flex-1 rounded-full px-4 py-2 text-center text-slate-500">Client Portal</span>
            </div>
          </div>

          <h1 className="text-center text-3xl font-semibold tracking-tight text-slate-900">
            Complete your signup
          </h1>
          <p className="mt-2 text-center text-sm text-slate-500">
            Set your password to access the dashboard.
          </p>
          {error && (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="text-base font-medium text-slate-700">Password</label>
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input w-full bg-white"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-base font-medium text-slate-700">Confirm password</label>
              <PasswordInput
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="form-input w-full bg-white"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Completing..." : "Complete signup"}
            </Button>
          </form>
        </section>
      </div>
    </div>
  );
}

