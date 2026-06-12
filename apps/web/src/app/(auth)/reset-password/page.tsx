"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { createSupabaseBrowserClient } from "@/lib/supabase";

type RecoveryState = "checking" | "ready" | "invalid";

export default function SupabaseResetPasswordPage() {
  const router = useRouter();
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [recoveryState, setRecoveryState] = useState<RecoveryState>("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      setSupabase(createSupabaseBrowserClient());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Supabase is not configured.");
      setRecoveryState("invalid");
    }
  }, []);

  useEffect(() => {
    if (!supabase) return;

    let active = true;
    const invalidTimer = window.setTimeout(() => {
      if (active) {
        setRecoveryState((current) => (current === "checking" ? "invalid" : current));
        setError((current) => current ?? "This reset link is invalid or expired.");
      }
    }, 2500);

    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) {
        setError(sessionError.message);
        setRecoveryState("invalid");
        return;
      }

      if (data.session) {
        setRecoveryState("ready");
        setError(null);
      }
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setRecoveryState("ready");
        setError(null);
      }
    });

    return () => {
      active = false;
      window.clearTimeout(invalidTimer);
      subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!supabase) {
      setError("Supabase is not configured.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (recoveryState !== "ready") {
      setError("Open this page from the password reset email link.");
      return;
    }

    setLoading(true);

    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <AuthPageShell
      title="Set a new password"
      subtitle="Choose a strong password for your staff account."
    >
      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/35 dark:text-red-300">
          {error}
        </div>
      ) : null}

      {recoveryState === "checking" ? (
        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-base text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
          Verifying your reset link...
        </div>
      ) : null}

      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block space-y-1.5">
          <span className="text-base font-medium text-slate-700 dark:text-slate-300">
            New password
          </span>
          <PasswordInput
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="form-input w-full"
            minLength={8}
            required
            disabled={recoveryState !== "ready" || loading}
            autoComplete="new-password"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-base font-medium text-slate-700 dark:text-slate-300">
            Confirm password
          </span>
          <PasswordInput
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="form-input w-full"
            minLength={8}
            required
            disabled={recoveryState !== "ready" || loading}
            autoComplete="new-password"
          />
        </label>

        <Button
          type="submit"
          className="w-full"
          disabled={recoveryState !== "ready" || loading}
        >
          {loading ? "Updating..." : "Update password"}
        </Button>
      </form>
    </AuthPageShell>
  );
}
