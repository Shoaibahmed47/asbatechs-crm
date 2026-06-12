"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ApiFetchError, apiFetch } from "@/lib/api-fetch";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      await apiFetch.post("/api/auth/forgot-password", { email });
      setSuccess("If that email exists in the CRM, a password reset link has been sent.");
    } catch (error) {
      setError(
        error instanceof ApiFetchError
          ? error.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full flex-col justify-center">
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Forgot password</h2>
          <p className="mt-1 text-base text-slate-500">
            Enter your email and we&apos;ll send you a reset link through Supabase Auth.
          </p>
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {success}
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1">
            <label className="block text-base font-medium text-slate-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="block w-full rounded-md border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
              placeholder="you@example.com"
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Sending..." : "Send reset link"}
          </Button>
        </form>
      </div>
    </div>
  );
}
