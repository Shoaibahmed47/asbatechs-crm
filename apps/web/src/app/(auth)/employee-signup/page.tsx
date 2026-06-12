"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
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
            Complete your invitation
          </h1>
          <p className="mt-2 text-center text-sm text-slate-500">
            {email ? `Set a password for ${email}.` : "Set a password to access the dashboard."}
          </p>

          {error && (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {inviteState === "checking" && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Verifying your invitation...
            </div>
          )}

          <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="text-base font-medium text-slate-700">Password</label>
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input w-full bg-white"
                minLength={8}
                required
                disabled={inviteState !== "ready" || loading}
              />
            </div>

            <div className="space-y-2">
              <label className="text-base font-medium text-slate-700">Confirm password</label>
              <PasswordInput
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="form-input w-full bg-white"
                minLength={8}
                required
                disabled={inviteState !== "ready" || loading}
              />
            </div>

            <Button type="submit" className="w-full" disabled={inviteState !== "ready" || loading}>
              {loading ? "Completing..." : "Complete signup"}
            </Button>
          </form>
        </section>
      </div>
    </div>
  );
}
