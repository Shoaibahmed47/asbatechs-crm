"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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
    <div className="app-shell flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 py-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.12),transparent_35%)]" />
      <div className="relative w-full max-w-md space-y-8 rounded-[28px] border border-slate-800 bg-slate-900/80 p-8 shadow-2xl backdrop-blur">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-400">
            Client portal
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white">
            Sign in
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Access your projects and share progress updates with your team.
          </p>
        </div>
        {error && (
          <div className="rounded-xl border border-red-900/60 bg-red-950/50 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-200">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="form-input w-full border-slate-700 bg-slate-950/50 text-white placeholder:text-slate-500"
              placeholder="you@company.com"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-200">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="form-input w-full border-slate-700 bg-slate-950/50 text-white"
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>
        <p className="text-center text-xs text-slate-500">
          Team member?{" "}
          <Link href="/login" className="font-medium text-sky-400 hover:text-sky-300">
            Staff login
          </Link>
        </p>
      </div>
    </div>
  );
}
