"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ApiFetchError, apiFetch } from "@/lib/api-fetch";

type ClientRow = {
  id: number;
  name: string;
  email: string;
  companyName: string | null;
};

export default function ClientProfilePage() {
  const [client, setClient] = useState<ClientRow | null>(null);
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch.get<{ client: ClientRow }>("/api/client/me");
        if (cancelled) return;
        setClient(data.client);
        setName(data.client.name);
        setCompanyName(data.client.companyName ?? "");
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof ApiFetchError ? e.message : "Failed to load profile");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await apiFetch.patch("/api/client/me", {
        name: name.trim(),
        companyName: companyName.trim() || null
      });
      setMessage("Profile saved.");
    } catch (err) {
      setError(
        err instanceof ApiFetchError ? err.message : "Could not save."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-slate-600 dark:text-slate-400">Loading…</p>;
  }

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Profile</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Your name and company shown to your delivery team.
        </p>
      </div>
      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
          {message}
        </div>
      )}
      <form className="space-y-4" onSubmit={save}>
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Email</label>
          <input
            type="email"
            value={client?.email ?? ""}
            disabled
            className="form-input w-full border-slate-300 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-900"
          />
          <p className="text-xs text-slate-600 dark:text-slate-500">Email cannot be changed here.</p>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Display name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="form-input w-full border-slate-300 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            required
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Company (optional)</label>
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="form-input w-full border-slate-300 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            placeholder="Company or brand name"
          />
        </div>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </form>
    </div>
  );
}
