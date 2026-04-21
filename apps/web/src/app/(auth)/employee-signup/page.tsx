"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ApiFetchError, apiFetch } from "@/lib/api-fetch";
import { createSupabaseBrowserClient } from "@/lib/supabase";

type InviteState = "checking" | "ready" | "invalid";

export default function EmployeeInviteSignupPage() {
  const router = useRouter();
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [inviteState, setInviteState] = useState<InviteState>("checking");
  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      setSupabase(createSupabaseBrowserClient());
    } catch (error) {
      setError(error instanceof Error ? error.message : "Supabase is not configured.");
      setInviteState("invalid");
    }
  }, []);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;

    let active = true;

    async function loadInviteSession() {
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      if (accessToken && refreshToken) {
        const { error } = await client.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        });

        if (error) {
          if (active) {
            setError(error.message);
            setInviteState("invalid");
          }
          return;
        }

        window.history.replaceState({}, document.title, window.location.pathname);
      }

      const {
        data: { session },
        error
      } = await client.auth.getSession();

      if (!active) return;

      if (error) {
        setError(error.message);
        setInviteState("invalid");
        return;
      }

      if (session?.user?.email) {
        setEmail(session.user.email);
        setInviteState("ready");
        return;
      }

      setError("Open this page from the invitation email link.");
      setInviteState("invalid");
    }

    void loadInviteSession();

    const {
      data: { subscription }
    } = client.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (session?.user?.email) {
        setEmail(session.user.email);
        setInviteState("ready");
        setError(null);
      }
    });

    return () => {
      active = false;
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

    if (inviteState !== "ready") {
      setError("Open this page from the invitation email link.");
      return;
    }

    setLoading(true);

    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      setError("Your invitation session expired. Open the invite email again.");
      setLoading(false);
      return;
    }

    const updateResult = await supabase.auth.updateUser({ password });
    if (updateResult.error) {
      setError(updateResult.error.message);
      setLoading(false);
      return;
    }

    try {
      await apiFetch.post("/api/auth/employee-signup", {
        accessToken: session.access_token
      });
      await supabase.auth.signOut();
      router.push("/login");
    } catch (error) {
      setError(
        error instanceof ApiFetchError
          ? error.message
          : "Your password was saved, but the CRM profile could not be completed."
      );
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full flex-col justify-center">
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Complete your invitation</h2>
          <p className="mt-1 text-sm text-slate-500">
            {email ? `Set a password for ${email}.` : "Set a password to access the dashboard."}
          </p>
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        {inviteState === "checking" && (
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Verifying your invitation...
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="block w-full rounded-md border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
              minLength={8}
              required
              disabled={inviteState !== "ready" || loading}
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
              disabled={inviteState !== "ready" || loading}
            />
          </div>

          <Button type="submit" className="w-full" disabled={inviteState !== "ready" || loading}>
            {loading ? "Completing..." : "Complete signup"}
          </Button>
        </form>
      </div>
    </div>
  );
}
