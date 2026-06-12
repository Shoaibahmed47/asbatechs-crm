"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ApiFetchError, apiFetch } from "@/lib/api-fetch";

export function InviteClientButton() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function sendInvite(action: "invite" | "resend") {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await apiFetch.post("/api/admin/client-invites", {
        email: email.trim(),
        action
      });
      setMessage(action === "resend" ? "Invitation resent." : "Invitation sent.");
      if (action === "invite") setEmail("");
    } catch (e) {
      if (e instanceof ApiFetchError && e.details && typeof e.details === "object") {
        const d = e.details as { canResend?: boolean; code?: string };
        if (d.canResend && action === "invite") {
          setError(`${e.message} You can resend.`);
          setBusy(false);
          return;
        }
      }
      setError(e instanceof ApiFetchError ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button type="button" onClick={() => setOpen(true)}>
        Invite client
      </Button>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-900/50">
      <div className="text-base font-medium text-slate-800 dark:text-slate-200">
        Invite client by email
      </div>
      <p className="text-base text-slate-500 dark:text-slate-400">
        They receive a link to set a password. Clients use a separate login at{" "}
        <span className="font-mono text-slate-600 dark:text-slate-300">/client/login</span>.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1">
          <label className="text-sm text-slate-500">Email</label>
          <input
            type="email"
            className="form-input w-full"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="client@company.com"
          />
        </div>
        <Button
          type="button"
          disabled={busy || !email.trim()}
          onClick={() => void sendInvite("invite")}
        >
          {busy ? "Sending…" : "Send invite"}
        </Button>
      </div>
      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : null}
      {message ? (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">{message}</p>
      ) : null}
      {error?.includes("resend") ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy || !email.trim()}
          onClick={() => void sendInvite("resend")}
        >
          Resend invite
        </Button>
      ) : null}
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
        Close
      </Button>
    </div>
  );
}
