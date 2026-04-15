"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ApiFetchError, apiFetch } from "@/lib/api-fetch";
import { cn } from "@/lib/utils";
import { Upload } from "lucide-react";

type Project = { id: number; name: string };

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

const MAX_FILES = 10;

export default function ClientWorkPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [updates, setUpdates] = useState<WorkUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [projectId, setProjectId] = useState("");
  const [gitRepoUrl, setGitRepoUrl] = useState("");
  const [pickedFiles, setPickedFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [p, u] = await Promise.all([
      apiFetch.get<{ projects: Project[] }>("/api/client/projects"),
      apiFetch.get<{ updates: WorkUpdate[] }>("/api/client/work-updates")
    ]);
    setProjects(p.projects);
    setUpdates(u.updates);
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

  useEffect(() => {
    if (typeof window === "undefined" || projects.length === 0) return;
    const q = new URLSearchParams(window.location.search).get("projectId");
    if (!q) return;
    const n = Number(q);
    if (Number.isFinite(n) && projects.some((p) => p.id === n)) {
      setProjectId(String(n));
    }
  }, [projects]);

  function addFilesFromList(list: FileList | File[]) {
    const arr = Array.from(list).filter((f) => f.size > 0);
    setPickedFiles((prev) => {
      const next = [...prev];
      for (const f of arr) {
        if (next.length >= MAX_FILES) break;
        next.push(f);
      }
      return next;
    });
  }

  function onFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) addFilesFromList(e.target.files);
    e.target.value = "";
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("title", title.trim());
      if (notes.trim()) fd.set("notes", notes.trim());
      if (projectId) fd.set("projectId", projectId);
      const git = gitRepoUrl.trim();
      if (git) fd.set("gitRepoUrl", git);
      for (const f of pickedFiles) {
        fd.append("files", f);
      }

      await apiFetch.post("/api/client/work-updates", fd);

      setTitle("");
      setNotes("");
      setProjectId("");
      setGitRepoUrl("");
      setPickedFiles([]);
      await load();
    } catch (err) {
      setError(err instanceof ApiFetchError ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: number) {
    if (!confirm("Remove this work update?")) return;
    try {
      await apiFetch.del(`/api/client/work-updates/${id}`);
      await load();
    } catch (err) {
      setError(err instanceof ApiFetchError ? err.message : "Delete failed");
    }
  }

  const projectName = (id: number | null) =>
    id == null ? "—" : projects.find((p) => p.id === id)?.name ?? `#${id}`;

  if (loading) {
    return <p className="text-slate-400">Loading…</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white">Work updates</h1>
        <p className="mt-2 text-sm text-slate-400">
          Share progress with your Git repository link and supporting files: images, PDF, and video
          (MP4, WebM, QuickTime). Drag files here or browse — up to {MAX_FILES} files per update, up to
          100MB per file.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-900/50 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <form
        onSubmit={submit}
        className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-6"
      >
        <div className="text-sm font-semibold text-slate-200">New update</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs text-slate-400">Title</label>
            <input
              className="form-input w-full border-slate-700 bg-slate-950 text-white"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="What did you ship or review?"
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs text-slate-400">Notes</label>
            <textarea
              className="form-input min-h-[88px] w-full border-slate-700 bg-slate-950 text-white"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-400">Project (optional)</label>
            <select
              className="form-input w-full border-slate-700 bg-slate-950 text-white"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              <option value="">— None —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs text-slate-400">Git repository</label>
            <input
              className="form-input w-full border-slate-700 bg-slate-950 text-white"
              value={gitRepoUrl}
              onChange={(e) => setGitRepoUrl(e.target.value)}
              placeholder="https://github.com/…"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs text-slate-400">Files (drag & drop)</label>
          <div
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            onClick={() => fileInputRef.current?.click()}
            onDragEnter={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragActive(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              if (e.dataTransfer.files?.length) addFilesFromList(e.dataTransfer.files);
            }}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition",
              dragActive
                ? "border-sky-500/70 bg-sky-500/10 text-sky-100"
                : "border-slate-600 bg-slate-950/50 text-slate-400 hover:border-slate-500 hover:bg-slate-900/60"
            )}
          >
            <Upload className="h-8 w-8 opacity-70" strokeWidth={1.5} />
            <p className="text-sm">
              Drop files here or <span className="font-medium text-sky-400">choose files</span>
            </p>
            <p className="text-xs text-slate-500">
              Images, PDF, MP4, WebM, QuickTime · max {MAX_FILES} files · up to 100MB each
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml,application/pdf,video/mp4,video/webm,video/quicktime"
            className="sr-only"
            onChange={onFileInputChange}
          />
          {pickedFiles.length > 0 ? (
            <ul className="space-y-1 rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-xs text-slate-300">
              {pickedFiles.map((f, i) => (
                <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate">{f.name}</span>
                  <button
                    type="button"
                    className="shrink-0 text-slate-500 hover:text-red-400"
                    onClick={() => setPickedFiles((prev) => prev.filter((_, j) => j !== i))}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Post update"}
        </Button>
      </form>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Recent updates
        </h2>
        {updates.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-500">
            No updates yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {updates.map((u) => (
              <li
                key={u.id}
                className="group relative rounded-xl border border-slate-800 bg-slate-900/40 transition hover:border-sky-500/35 hover:bg-slate-900/60"
              >
                <Link
                  href={`/client/work/${u.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute inset-0 z-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50"
                  aria-label={`View full update: ${u.title}. Opens in a new tab.`}
                />
                <div className="relative z-10 flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1 pointer-events-none">
                    <div className="font-medium text-white">{u.title}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      Project: {projectName(u.projectId)}
                      {u.status ? ` · ${u.status}` : ""}
                      {u.createdAt ? ` · ${new Date(u.createdAt).toLocaleString()}` : ""}
                    </div>
                    {u.notes ? (
                      <p className="mt-2 text-sm text-slate-400">{u.notes}</p>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="relative z-10 shrink-0 border-slate-600 bg-slate-950 text-slate-300 pointer-events-auto"
                    onClick={() => void remove(u.id)}
                  >
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
