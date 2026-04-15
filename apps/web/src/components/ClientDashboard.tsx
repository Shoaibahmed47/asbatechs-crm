"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ApiFetchError, apiFetch } from "@/lib/api-fetch";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";

type Project = {
  id: number;
  name: string;
  description: string | null;
  createdAt: string | null;
};

type WorkAttachment = {
  fileName: string;
  storagePath: string;
  mimeType: string;
};

type WorkUpdate = {
  id: number;
  projectId: number | null;
  title: string;
  notes: string | null;
  screenshotUrl: string | null;
  gitRepoUrl: string | null;
  documentUrl: string | null;
  linkUrl: string | null;
  attachments: WorkAttachment[] | null;
  status: string;
  createdAt: string | null;
};

export function ClientDashboard({ clientName }: { clientName: string | null }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [updates, setUpdates] = useState<WorkUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [pRes, uRes] = await Promise.all([
      apiFetch.get<{ projects: Project[] }>("/api/client/projects"),
      apiFetch.get<{ updates: WorkUpdate[] }>("/api/client/work-updates")
    ]);
    const list = pRes.projects;
    setProjects(list);
    setUpdates(uRes.updates);
    setSelectedId((prev) => {
      if (prev != null && list.some((x) => x.id === prev)) return prev;
      return list[0]?.id ?? null;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await load();
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof ApiFetchError ? e.message : "Failed to load");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function addProject(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch.post("/api/client/projects", {
        name: newName.trim(),
        description: newDescription.trim() || null
      });
      setNewName("");
      setNewDescription("");
      setShowAdd(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiFetchError ? err.message : "Could not add project");
    } finally {
      setSaving(false);
    }
  }

  const selected = projects.find((p) => p.id === selectedId) ?? null;

  const projectLabel = (id: number | null) =>
    id == null ? "General" : projects.find((p) => p.id === id)?.name ?? `Project #${id}`;

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col gap-6 lg:flex-row lg:items-stretch">
      {/* Left: projects */}
      <aside className="lg:w-72 lg:shrink-0 lg:border-r lg:border-slate-800 lg:pr-6">
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Your projects
        </div>
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : projects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/30 p-4 text-sm text-slate-500">
            No projects yet. Use{" "}
            <span className="font-medium text-slate-400">Add project</span> above to create one.
          </div>
        ) : (
          <ul className="space-y-1">
            {projects.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(p.id)}
                  className={cn(
                    "flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm transition",
                    selectedId === p.id
                      ? "bg-sky-500/15 font-medium text-sky-100 ring-1 ring-sky-500/40"
                      : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
                  )}
                >
                  <span className="line-clamp-2">{p.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <Link
          href="/client/projects"
          className="mt-4 inline-flex text-xs font-medium text-slate-500 hover:text-sky-400"
        >
          Manage all projects →
        </Link>
      </aside>

      {/* Main */}
      <div className="min-w-0 flex-1 space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Welcome{clientName ? `, ${clientName}` : ""}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
              Projects appear in the sidebar. Add a new one with the button, then share work updates
              with links and files.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="shrink-0 gap-2 border-slate-600 bg-slate-900 text-slate-100 hover:bg-slate-800 hover:text-white"
            onClick={() => {
              setShowAdd((v) => !v);
              setError(null);
            }}
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            Add project
          </Button>
        </div>

        {showAdd && (
          <form
            onSubmit={addProject}
            className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-5 ring-1 ring-sky-500/20"
          >
            <div className="text-sm font-medium text-slate-200">New project</div>
            {error ? (
              <p className="text-sm text-red-400">{error}</p>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs text-slate-500">Name</label>
                <input
                  className="form-input w-full border-slate-700 bg-slate-950 text-white"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Website redesign"
                  autoFocus
                  required
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs text-slate-500">Description (optional)</label>
                <textarea
                  className="form-input min-h-[72px] w-full border-slate-700 bg-slate-950 text-white"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={saving || !newName.trim()}>
                {saving ? "Saving…" : "Create project"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="border-slate-600"
                onClick={() => {
                  setShowAdd(false);
                  setNewName("");
                  setNewDescription("");
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}

        <section className="rounded-2xl border border-slate-800 bg-slate-900/40">
          <div className="flex flex-col gap-3 border-b border-slate-800 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Your updates
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Latest posts across all projects (newest first).
              </p>
            </div>
            <Link
              href={
                selected ? `/client/work?projectId=${selected.id}` : "/client/work"
              }
              className="inline-flex shrink-0 items-center justify-center rounded-xl bg-white px-4 py-2 text-sm font-medium text-slate-900 shadow hover:bg-slate-100"
            >
              {selected ? `New update — ${selected.name}` : "New work update"}
            </Link>
          </div>
          <div className="max-h-[min(28rem,50vh)] overflow-y-auto p-3">
            {loading ? (
              <p className="px-2 py-8 text-center text-sm text-slate-500">Loading updates…</p>
            ) : !loading && updates.length === 0 ? (
              <p className="px-2 py-8 text-center text-sm text-slate-500">
                No updates yet.{" "}
                <Link href="/client/work" className="font-medium text-sky-400 hover:underline">
                  Add your first
                </Link>
                .
              </p>
            ) : (
              <ul className="space-y-2">
                {updates.map((u) => (
                  <li
                    key={u.id}
                    className="group relative rounded-xl border border-slate-800/80 bg-slate-950/40 transition hover:border-sky-500/35 hover:bg-slate-900/50"
                  >
                    <Link
                      href={`/client/work/${u.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute inset-0 z-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50"
                      aria-label={`View full update: ${u.title}. Opens in a new tab.`}
                    />
                    <div className="pointer-events-none relative z-10 px-4 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-slate-100">{u.title}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-slate-300">
                              {projectLabel(u.projectId)}
                            </span>
                            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-slate-300">
                              {u.status}
                            </span>
                            {u.createdAt ? (
                              <span>{new Date(u.createdAt).toLocaleString()}</span>
                            ) : null}
                          </div>
                          {u.notes ? (
                            <p className="mt-2 line-clamp-2 text-sm text-slate-400">{u.notes}</p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
