"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
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
    <div className="app-shell flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 py-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.12),transparent_35%)]" />
      <div className="relative w-full max-w-md space-y-8 rounded-[28px] border border-slate-800 bg-slate-900/80 p-8 shadow-2xl backdrop-blur">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Complete client signup
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Set your name and password, then sign in on the next page.
          </p>
        </div>
        {error && (
          <div className="rounded-xl border border-red-900/60 bg-red-950/50 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-200">Display name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="form-input w-full border-slate-700 bg-slate-950/50 text-white"
              placeholder="Your name or company"
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
              minLength={8}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-200">
              Confirm password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="form-input w-full border-slate-700 bg-slate-950/50 text-white"
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Saving..." : "Create account"}
          </Button>
        </form>
        <p className="text-center text-xs text-slate-500">
          <Link href="/client/login" className="text-sky-400 hover:text-sky-300">
            Back to client sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
