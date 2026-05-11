"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiFetchError, apiFetch } from "@/lib/api-fetch";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ClientOption = { id: number; name: string };
type ProjectOption = { id: number; clientId: number; name: string };
type WorkAttachment = {
  fileName: string;
  storagePath: string;
  mimeType: string;
};
type UpdateRow = {
  id: number;
  clientId: number;
  projectId: number | null;
  title: string;
  notes: string | null;
  status: string;
  gitRepoUrl: string | null;
  attachments: WorkAttachment[] | null;
  projectName: string | null;
  clientName: string | null;
  createdAt: string | null;
  authorType?: "client" | "employee" | "admin" | string;
  authorName?: string | null;
};

function authorBadgeClass(authorType?: string) {
  if (authorType === "client") {
    return "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300";
  }
  if (authorType === "employee") {
    return "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300";
  }
  if (authorType === "admin") {
    return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
  }
  return "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
}

function authorLabel(authorType?: string) {
  if (authorType === "client") return "CLIENT";
  if (authorType === "employee") return "EMPLOYEE";
  if (authorType === "admin") return "ADMIN";
  return "LEGACY";
}

function ExistingAttachmentPreview({
  att,
  onRemove
}: {
  att: WorkAttachment;
  onRemove: () => void;
}) {
  const href = `/${att.storagePath.replace(/^\/+/, "")}`;
  const removeButton = (
    <button
      type="button"
      aria-label={`Remove ${att.fileName}`}
      className="absolute right-1 top-1 z-10 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white hover:bg-red-600"
      onClick={onRemove}
    >
      ×
    </button>
  );

  if (att.mimeType.startsWith("image/")) {
    return (
      <div className="relative overflow-hidden rounded-md border border-slate-700/60 bg-slate-950/40">
        {removeButton}
        <img src={href} alt={att.fileName} className="aspect-square w-full object-cover" />
      </div>
    );
  }
  if (att.mimeType.startsWith("video/")) {
    return (
      <div className="relative overflow-hidden rounded-md border border-slate-700/60 bg-slate-950/40">
        {removeButton}
        <video
          src={href}
          muted
          playsInline
          autoPlay
          loop
          preload="metadata"
          className="aspect-square w-full object-cover"
        />
      </div>
    );
  }
  if (att.mimeType === "application/pdf") {
    return (
      <div className="relative flex aspect-square w-full items-center justify-center rounded-md border border-slate-700/60 bg-slate-950/40 text-[10px] text-slate-300">
        {removeButton}
        PDF
      </div>
    );
  }
  return (
    <div className="relative flex aspect-square w-full items-center justify-center rounded-md border border-slate-700/60 bg-slate-950/40 px-2 text-center text-[10px] text-slate-300">
      {removeButton}
      {att.fileName}
    </div>
  );
}

function PickedFilePreview({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [url, setUrl] = useState<string>("");
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  if (!url) return null;

  const removeButton = (
    <button
      type="button"
      aria-label={`Remove ${file.name}`}
      className="absolute right-1 top-1 z-10 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white hover:bg-red-600"
      onClick={onRemove}
    >
      ×
    </button>
  );

  if (file.type.startsWith("image/")) {
    return (
      <div className="relative overflow-hidden rounded-md border border-slate-700/60 bg-slate-950/40">
        {removeButton}
        <img src={url} alt={file.name} className="aspect-square w-full object-cover" />
      </div>
    );
  }
  if (file.type.startsWith("video/")) {
    return (
      <div className="relative overflow-hidden rounded-md border border-slate-700/60 bg-slate-950/40">
        {removeButton}
        <video
          src={url}
          muted
          playsInline
          autoPlay
          loop
          preload="metadata"
          className="aspect-square w-full object-cover"
        />
      </div>
    );
  }
  if (file.type === "application/pdf") {
    return (
      <div className="relative flex aspect-square w-full items-center justify-center rounded-md border border-slate-700/60 bg-slate-950/40 text-[10px] text-slate-300">
        {removeButton}
        PDF
      </div>
    );
  }
  return (
    <div className="relative flex aspect-square w-full items-center justify-center rounded-md border border-slate-700/60 bg-slate-950/40 px-2 text-center text-[10px] text-slate-300">
      {removeButton}
      {file.name}
    </div>
  );
}

export default function InternalWorkUpdatesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [updates, setUpdates] = useState<UpdateRow[]>([]);
  const [isAssignmentRestricted, setIsAssignmentRestricted] = useState(false);

  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [gitRepoUrl, setGitRepoUrl] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [editingUpdateId, setEditingUpdateId] = useState<number | null>(null);
  const [editingExistingAttachments, setEditingExistingAttachments] = useState<WorkAttachment[]>([]);
  const [removedAttachmentPaths, setRemovedAttachmentPaths] = useState<string[]>([]);

  const addPickedFiles = (incoming: File[]) => {
    setFiles((prev) => {
      const next = [...prev];
      for (const file of incoming) {
        const duplicate = next.some(
          (f) => f.name === file.name && f.size === file.size && f.lastModified === file.lastModified
        );
        if (!duplicate) next.push(file);
      }
      return next;
    });
  };

  const load = useCallback(async () => {
    const res = await apiFetch.get<{
      updates: UpdateRow[];
      clients: ClientOption[];
      projects: ProjectOption[];
      isAssignmentRestricted?: boolean;
    }>("/api/work-updates");
    setUpdates(res.updates);
    setClients(res.clients);
    setProjects(res.projects);
    setIsAssignmentRestricted(Boolean(res.isAssignmentRestricted));
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

  const visibleProjects = useMemo(() => {
    if (!clientId) return [];
    const id = Number(clientId);
    return projects.filter((p) => p.clientId === id);
  }, [projects, clientId]);

  useEffect(() => {
    if (!isAssignmentRestricted) return;
    if (!clientId && clients.length > 0) {
      setClientId(String(clients[0].id));
    }
  }, [isAssignmentRestricted, clients, clientId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId || !title.trim()) return;
    if (isAssignmentRestricted && !projectId) {
      setError("Please select one assigned project.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("clientId", clientId);
      if (projectId) fd.set("projectId", projectId);
      fd.set("title", title.trim());
      if (notes.trim()) fd.set("notes", notes.trim());
      if (gitRepoUrl.trim()) fd.set("gitRepoUrl", gitRepoUrl.trim());
      for (const f of files) fd.append("files", f);
      if (editingUpdateId != null) {
        for (const path of removedAttachmentPaths) {
          fd.append("removeAttachmentPaths", path);
        }
      }
      if (editingUpdateId != null) {
        await apiFetch.patch(`/api/work-updates/${editingUpdateId}`, fd, {
          timeoutMs: 180000
        });
      } else {
        await apiFetch.post("/api/work-updates", fd, {
          timeoutMs: 180000
        });
      }
      setTitle("");
      setNotes("");
      setGitRepoUrl("");
      setProjectId("");
      setFiles([]);
      setEditingUpdateId(null);
      setEditingExistingAttachments([]);
      setRemovedAttachmentPaths([]);
      await load();
    } catch (e) {
      setError(e instanceof ApiFetchError ? e.message : "Could not submit update");
    } finally {
      setSaving(false);
    }
  }

  async function removeUpdate(id: number) {
    if (!confirm("Delete this work update? This cannot be undone.")) return;
    try {
      setError(null);
      await apiFetch.del(`/api/work-updates/${id}`);
      if (editingUpdateId === id) {
        setEditingUpdateId(null);
        setTitle("");
        setNotes("");
        setGitRepoUrl("");
        setProjectId("");
        setFiles([]);
        setEditingExistingAttachments([]);
        setRemovedAttachmentPaths([]);
      }
      await load();
    } catch (e) {
      setError(e instanceof ApiFetchError ? e.message : "Delete failed");
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">Work updates</h1>
        <p className="page-subtitle">Post implementation progress for clients and track review status.</p>
      </div>

      {error ? <p className="text-sm text-red-500">{error}</p> : null}

      <form onSubmit={submit} className="data-card space-y-4">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
          {editingUpdateId != null ? "Edit work update" : "New work update"}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs text-slate-500">Client</label>
            <select
              className="form-input w-full"
              value={clientId}
              onChange={(e) => {
                setClientId(e.target.value);
                setProjectId("");
              }}
              required
            >
              <option value="">Select client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-500">Project</label>
            <select className="form-input w-full" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              {!isAssignmentRestricted ? <option value="">General</option> : <option value="">Select project</option>}
              {visibleProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs text-slate-500">Title</label>
            <input className="form-input w-full" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs text-slate-500">Notes</label>
            <textarea className="form-input min-h-[86px] w-full" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs text-slate-500">Git repository</label>
            <input
              className="form-input w-full"
              value={gitRepoUrl}
              onChange={(e) => setGitRepoUrl(e.target.value)}
              placeholder="https://github.com/..."
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs text-slate-500">Files</label>
            <input
              type="file"
              multiple
              className="form-input w-full"
              onChange={(e) => {
                const picked = Array.from(e.target.files ?? []);
                if (picked.length > 0) addPickedFiles(picked);
                e.currentTarget.value = "";
              }}
            />
            {files.length > 0 ? (
              <div className="mt-2 grid grid-cols-5 gap-1.5 md:grid-cols-10">
                {files.map((f, index) => (
                  <div key={`${f.name}-${f.size}-${index}`} className="w-full max-w-[64px]">
                    <PickedFilePreview
                      file={f}
                      onRemove={() => setFiles((prev) => prev.filter((_, i) => i !== index))}
                    />
                  </div>
                ))}
              </div>
            ) : null}
            {editingUpdateId != null && editingExistingAttachments.length > 0 ? (
              <div className="mt-2 rounded-md border border-slate-700/60 bg-slate-900/40 p-3">
                <div className="mt-2 grid grid-cols-5 gap-1.5 md:grid-cols-10">
                  {editingExistingAttachments.map((att) => (
                    <div key={att.storagePath} className="w-full max-w-[64px]">
                      <ExistingAttachmentPreview
                        att={att}
                        onRemove={() => {
                          setRemovedAttachmentPaths((prev) => [...prev, att.storagePath]);
                          setEditingExistingAttachments((prev) =>
                            prev.filter((x) => x.storagePath !== att.storagePath)
                          );
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
        {isAssignmentRestricted ? (
          <p className="text-xs text-slate-500">
            You can only post updates for client projects assigned to you by admin.
          </p>
        ) : null}
        <Button type="submit" disabled={saving}>
          {saving ? "Submitting..." : editingUpdateId != null ? "Update work" : "Submit update"}
        </Button>
        {editingUpdateId != null ? (
          <Button
            type="button"
            variant="outline"
            className="ml-2"
            onClick={() => {
              setEditingUpdateId(null);
              setTitle("");
              setNotes("");
              setGitRepoUrl("");
              setProjectId("");
              setFiles([]);
              setEditingExistingAttachments([]);
              setRemovedAttachmentPaths([]);
            }}
          >
            Cancel edit
          </Button>
        ) : null}
      </form>

      <section className="data-card space-y-3">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Latest updates</h2>
        {loading ? (
          <p className="text-sm text-slate-500">Loading...</p>
        ) : updates.length === 0 ? (
          <p className="text-sm text-slate-500">No updates yet.</p>
        ) : (
          <ul className="space-y-2">
            {updates.map((u) => (
              <li key={u.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">{u.title}</p>
                    <p className="text-xs text-slate-500">
                      {u.clientName ?? "Client"} · {u.projectName ?? "General"} · {u.status}
                      {u.createdAt ? ` · ${new Date(u.createdAt).toLocaleString()}` : ""}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 font-semibold tracking-wide",
                          authorBadgeClass(u.authorType)
                        )}
                      >
                        {authorLabel(u.authorType)}
                      </span>
                      <span className="text-slate-600 dark:text-slate-400">
                        By {u.authorName ?? "Unknown"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Link
                      href={`/work-updates/${u.id}`}
                      className="text-sm font-medium text-sky-600 hover:underline"
                    >
                      Open
                    </Link>
                    <button
                      type="button"
                      className="text-sm font-medium text-sky-600 hover:underline"
                      onClick={() => {
                        setEditingUpdateId(u.id);
                        setClientId(String(u.clientId));
                        setProjectId(u.projectId != null ? String(u.projectId) : "");
                        setTitle(u.title);
                        setNotes(u.notes ?? "");
                        setGitRepoUrl(u.gitRepoUrl ?? "");
                        setFiles([]);
                        setEditingExistingAttachments(u.attachments ?? []);
                        setRemovedAttachmentPaths([]);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="text-sm font-medium text-red-600 hover:underline"
                      onClick={() => void removeUpdate(u.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
