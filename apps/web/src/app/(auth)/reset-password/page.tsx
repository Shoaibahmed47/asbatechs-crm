"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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
    } catch (error) {
      setError(error instanceof Error ? error.message : "Supabase is not configured.");
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

    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) {
        setError(error.message);
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

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (recoveryState !== "ready") {
      setError("Open this page from the password reset email link.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="flex h-full flex-col justify-center">
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Set a new password</h2>
          <p className="mt-1 text-sm text-slate-500">
            Choose a new password for your staff account.
          </p>
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        {recoveryState === "checking" && (
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Verifying your reset link...
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">New password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="block w-full rounded-md border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
              minLength={8}
              required
              disabled={recoveryState !== "ready" || loading}
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">
              Confirm password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="block w-full rounded-md border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
              minLength={8}
              required
              disabled={recoveryState !== "ready" || loading}
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={recoveryState !== "ready" || loading}
          >
            {loading ? "Updating..." : "Update password"}
          </Button>
        </form>
      </div>
    </div>
  );
}
