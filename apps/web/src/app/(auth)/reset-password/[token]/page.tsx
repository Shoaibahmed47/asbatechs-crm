"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { ApiFetchError, apiFetch } from "@/lib/api-fetch";

export default function ResetPasswordPage() {
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

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!token) {
      setError("Invalid or missing reset link.");
      return;
    }

    setLoading(true);
    try {
      await apiFetch.post("/api/auth/reset-password", { token, password });
      router.push("/login");
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
    <AuthPageShell
      title="Set a new password"
      subtitle="Choose a strong password for your account. This link expires after one hour."
    >
      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/35 dark:text-red-300">
          {error}
        </div>
      ) : null}

      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block space-y-1.5">
          <span className="text-base font-medium text-slate-700 dark:text-slate-300">
            New password
          </span>
          <PasswordInput
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="form-input w-full"
            minLength={8}
            required
            disabled={loading}
            autoComplete="new-password"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-base font-medium text-slate-700 dark:text-slate-300">
            Confirm password
          </span>
          <PasswordInput
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="form-input w-full"
            minLength={8}
            required
            disabled={loading}
            autoComplete="new-password"
          />
        </label>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Updating..." : "Update password"}
        </Button>
      </form>
    </AuthPageShell>
  );
}
