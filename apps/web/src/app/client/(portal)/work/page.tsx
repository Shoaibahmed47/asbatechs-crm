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
  authorType?: "client" | "employee" | "admin" | string;
  authorName?: string | null;
  createdAt: string | null;
};

type LegacyMediaPreview = {
  url: string;
  fileName: string;
  mimeType: string;
};

const MAX_FILES = 10;
const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024;
const MAX_TOTAL_UPLOAD_BYTES = 100 * 1024 * 1024;
const ALLOWED_FILE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "application/pdf",
  "video/mp4",
  "video/webm",
  "video/quicktime"
]);

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
      <div className="relative overflow-hidden rounded-md border border-slate-300 bg-white dark:border-slate-700/60 dark:bg-slate-950/40">
        {removeButton}
        <img src={url} alt={file.name} className="aspect-square w-full object-cover" />
      </div>
    );
  }
  if (file.type.startsWith("video/")) {
    return (
      <div className="relative overflow-hidden rounded-md border border-slate-300 bg-white dark:border-slate-700/60 dark:bg-slate-950/40">
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
      <div className="relative flex aspect-square w-full items-center justify-center rounded-md border border-slate-300 bg-white text-[10px] text-slate-700 dark:border-slate-700/60 dark:bg-slate-950/40 dark:text-slate-300">
        {removeButton}
        PDF
      </div>
    );
  }
  return (
    <div className="relative flex aspect-square w-full items-center justify-center rounded-md border border-slate-300 bg-white px-2 text-center text-[10px] text-slate-700 dark:border-slate-700/60 dark:bg-slate-950/40 dark:text-slate-300">
      {removeButton}
      {file.name}
    </div>
  );
}

function ExistingAttachmentPreview({
  updateId,
  index,
  attachment,
  onRemove
}: {
  updateId: number;
  index: number;
  attachment: WorkAttachment;
  onRemove: () => void;
}) {
  const src =
    attachment.storagePath.startsWith("/uploads/")
      ? attachment.storagePath
      : `/api/client/work-updates/${updateId}/attachments/${index}`;

  if (attachment.mimeType.startsWith("image/")) {
    return (
      <div className="relative">
        <button
          type="button"
          aria-label={`Remove ${attachment.fileName}`}
          className="absolute right-1 top-1 z-10 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white hover:bg-red-600"
          onClick={(e) => {
            e.preventDefault();
            onRemove();
          }}
        >
          ×
        </button>
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="block overflow-hidden rounded-md border border-slate-300 bg-white dark:border-slate-700/60 dark:bg-slate-950/40"
        >
          <img src={src} alt={attachment.fileName} className="aspect-square w-full object-cover" />
        </a>
      </div>
    );
  }

  if (attachment.mimeType.startsWith("video/")) {
    return (
      <div className="relative">
        <button
          type="button"
          aria-label={`Remove ${attachment.fileName}`}
          className="absolute right-1 top-1 z-10 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white hover:bg-red-600"
          onClick={(e) => {
            e.preventDefault();
            onRemove();
          }}
        >
          ×
        </button>
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="block overflow-hidden rounded-md border border-slate-300 bg-white dark:border-slate-700/60 dark:bg-slate-950/40"
        >
          <video
            src={src}
            muted
            playsInline
            autoPlay
            loop
            preload="metadata"
            className="aspect-square w-full object-cover"
          />
        </a>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={`Remove ${attachment.fileName}`}
        className="absolute right-1 top-1 z-10 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white hover:bg-red-600"
        onClick={(e) => {
          e.preventDefault();
          onRemove();
        }}
      >
        ×
      </button>
      <a
        href={src}
        target="_blank"
        rel="noopener noreferrer"
        className="flex aspect-square w-full items-center justify-center rounded-md border border-slate-300 bg-white px-2 text-center text-[10px] text-slate-700 hover:bg-slate-50 dark:border-slate-700/60 dark:bg-slate-950/40 dark:text-slate-300 dark:hover:bg-slate-900/50"
        title={attachment.fileName}
      >
        {attachment.fileName}
      </a>
    </div>
  );
}

function ExistingLegacyPreview({ item }: { item: LegacyMediaPreview }) {
  if (item.mimeType.startsWith("image/")) {
    return (
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block overflow-hidden rounded-md border border-slate-300 bg-white dark:border-slate-700/60 dark:bg-slate-950/40"
      >
        <img src={item.url} alt={item.fileName} className="aspect-square w-full object-cover" />
      </a>
    );
  }

  if (item.mimeType.startsWith("video/")) {
    return (
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block overflow-hidden rounded-md border border-slate-300 bg-white dark:border-slate-700/60 dark:bg-slate-950/40"
      >
        <video
          src={item.url}
          muted
          playsInline
          autoPlay
          loop
          preload="metadata"
          className="aspect-square w-full object-cover"
        />
      </a>
    );
  }

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex aspect-square w-full items-center justify-center rounded-md border border-slate-300 bg-white px-2 text-center text-[10px] text-slate-700 hover:bg-slate-50 dark:border-slate-700/60 dark:bg-slate-950/40 dark:text-slate-300 dark:hover:bg-slate-900/50"
      title={item.fileName}
    >
      {item.fileName}
    </a>
  );
}

function inferMimeFromUrl(url: string): string {
  const cleaned = url.split("?")[0]?.toLowerCase() ?? "";
  if (/\.(png|jpe?g|gif|webp|svg)$/.test(cleaned)) return "image/*";
  if (/\.(mp4|webm|mov|m4v)$/.test(cleaned)) return "video/*";
  if (/\.pdf$/.test(cleaned)) return "application/pdf";
  return "application/octet-stream";
}

function buildLegacyMedia(update: WorkUpdate): LegacyMediaPreview[] {
  const list: LegacyMediaPreview[] = [];
  const pushIf = (url: string | null, fallbackName: string) => {
    if (!url) return;
    const fileName = url.split("/").pop()?.split("?")[0] || fallbackName;
    list.push({
      url,
      fileName,
      mimeType: inferMimeFromUrl(url)
    });
  };

  pushIf(update.screenshotUrl, "screenshot");
  pushIf(update.documentUrl, "document");
  pushIf(update.linkUrl, "link");
  return list;
}

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
  const [editingUpdateId, setEditingUpdateId] = useState<number | null>(null);
  const [editingAttachments, setEditingAttachments] = useState<WorkAttachment[]>([]);
  const [editingLegacyMedia, setEditingLegacyMedia] = useState<LegacyMediaPreview[]>([]);
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

  useEffect(() => {
    if (typeof window === "undefined" || updates.length === 0) return;
    const q = new URLSearchParams(window.location.search).get("editId");
    if (!q) return;
    const editId = Number(q);
    if (!Number.isFinite(editId)) return;
    const update = updates.find((u) => u.id === editId);
    if (!update) return;

    setEditingUpdateId(update.id);
    setTitle(update.title);
    setNotes(update.notes ?? "");
    setProjectId(update.projectId != null ? String(update.projectId) : "");
    setGitRepoUrl(update.gitRepoUrl ?? "");
    setPickedFiles([]);
    setEditingAttachments(update.attachments ?? []);
    setEditingLegacyMedia(buildLegacyMedia(update));
    setError(null);
  }, [updates]);

  function addFilesFromList(list: FileList | File[]) {
    const arr = Array.from(list).filter((f) => f.size > 0);
    const valid: File[] = [];
    for (const file of arr) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setError(`"${file.name}" is too large. File must be 100MB or less.`);
        continue;
      }
      if (!ALLOWED_FILE_TYPES.has(file.type)) {
        setError(
          `"${file.name}" has an unsupported format. Use JPG, PNG, GIF, WebP, SVG, PDF, MP4, WebM, or MOV.`
        );
        continue;
      }
      valid.push(file);
    }
    setPickedFiles((prev) => {
      const next = [...prev];
      const didOverflow = prev.length + valid.length > MAX_FILES;
      const currentTotal = prev.reduce((sum, f) => sum + f.size, 0);
      let runningTotal = currentTotal;
      for (const f of valid) {
        if (next.length >= MAX_FILES) break;
        if (runningTotal + f.size > MAX_TOTAL_UPLOAD_BYTES) {
          setError("Total upload size must be 100MB or less.");
          continue;
        }
        next.push(f);
        runningTotal += f.size;
      }
      if (didOverflow) {
        setError(`You can upload up to ${MAX_FILES} files per update.`);
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
      const trimmedTitle = title.trim();
      if (!trimmedTitle) {
        throw new Error("Title is required.");
      }
      if (trimmedTitle.length > 300) {
        throw new Error("Title must be 300 characters or less.");
      }
      if (notes.trim().length > 8000) {
        throw new Error("Notes must be 8000 characters or less.");
      }
      if (projectId && !projects.some((p) => String(p.id) === projectId)) {
        throw new Error("Please select a valid project.");
      }
      const totalSelectedBytes = pickedFiles.reduce((sum, f) => sum + f.size, 0);
      if (totalSelectedBytes > MAX_TOTAL_UPLOAD_BYTES) {
        throw new Error("Total upload size must be 100MB or less.");
      }

      const fd = new FormData();
      if (editingUpdateId != null) {
        const payload = {
          title: trimmedTitle,
          notes: notes.trim() || null,
          projectId: projectId ? Number(projectId) : null,
          gitRepoUrl: gitRepoUrl.trim() || null,
          attachments: editingAttachments
        };
        if (pickedFiles.length > 0) {
          fd.set("payload", JSON.stringify(payload));
          for (const f of pickedFiles) {
            fd.append("files", f);
          }
          await apiFetch.patch(`/api/client/work-updates/${editingUpdateId}`, fd, {
            timeoutMs: 180000
          });
        } else {
          await apiFetch.patch(`/api/client/work-updates/${editingUpdateId}`, payload);
        }
      } else {
        fd.set("title", trimmedTitle);
        if (notes.trim()) fd.set("notes", notes.trim());
        if (projectId) fd.set("projectId", projectId);
        const git = gitRepoUrl.trim();
        if (git) fd.set("gitRepoUrl", git);
        for (const f of pickedFiles) {
          fd.append("files", f);
        }

        await apiFetch.post("/api/client/work-updates", fd, {
          // Media uploads can take longer than default request timeout.
          timeoutMs: 180000
        });
      }

      setTitle("");
      setNotes("");
      setProjectId("");
      setGitRepoUrl("");
      setPickedFiles([]);
      setEditingUpdateId(null);
      setEditingAttachments([]);
      setEditingLegacyMedia([]);
      await load();
    } catch (err) {
      if (err instanceof ApiFetchError) {
        if (err.message === "Invalid form data") {
          setError("Upload is too large or malformed. Keep total upload size within 100MB.");
        } else {
          setError(err.message);
        }
      } else {
        setError(err instanceof Error ? err.message : "Could not save");
      }
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
  const authorBadgeClass = (authorType?: string) => {
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
  };
  const authorLabel = (authorType?: string) => {
    if (authorType === "client") return "CLIENT";
    if (authorType === "employee") return "EMPLOYEE";
    if (authorType === "admin") return "ADMIN";
    return "LEGACY";
  };

  if (loading) {
    return <p className="text-slate-600 dark:text-slate-400">Loading…</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Work updates</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Share progress with your Git repository link and supporting files: images, PDF, and video
          (MP4, WebM, QuickTime). Drag files here or browse — up to {MAX_FILES} files per update, up to
          100MB per file.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      <form
        onSubmit={submit}
        className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900/50"
      >
        <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          {editingUpdateId != null ? "Edit update" : "New update"}
        </div>
        {editingUpdateId != null ? (
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Editing update #{editingUpdateId}. You can keep/remove existing media and add new files.
          </p>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs text-slate-600 dark:text-slate-400">Title</label>
            <input
              className="form-input w-full border-slate-300 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="What did you ship or review?"
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs text-slate-600 dark:text-slate-400">Notes</label>
            <textarea
              className="form-input min-h-[88px] w-full border-slate-300 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-600 dark:text-slate-400">Project (optional)</label>
            <select
              className="form-input w-full border-slate-300 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
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
            <label className="text-xs text-slate-600 dark:text-slate-400">Git repository</label>
            <input
              className="form-input w-full border-slate-300 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              value={gitRepoUrl}
              onChange={(e) => setGitRepoUrl(e.target.value)}
              placeholder="https://github.com/…"
            />
          </div>
        </div>

        {editingUpdateId != null &&
        (editingAttachments.length > 0 || editingLegacyMedia.length > 0) ? (
          <div className="space-y-2">
            <label className="text-xs text-slate-600 dark:text-slate-400">Existing media</label>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/40">
              <div className="grid grid-cols-5 gap-1.5 md:grid-cols-10">
                {editingAttachments.map((attachment, index) => (
                  <div key={`${attachment.storagePath}-${index}`} className="w-full max-w-[64px]">
                    <ExistingAttachmentPreview
                      updateId={editingUpdateId}
                      index={index}
                      attachment={attachment}
                      onRemove={() =>
                        setEditingAttachments((prev) =>
                          prev.filter((item) => item.storagePath !== attachment.storagePath)
                        )
                      }
                    />
                  </div>
                ))}
                {editingLegacyMedia.map((item, index) => (
                  <div key={`${item.url}-${index}`} className="w-full max-w-[64px]">
                    <ExistingLegacyPreview item={item} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          <label className="text-xs text-slate-600 dark:text-slate-400">Files (drag & drop)</label>
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
                ? "border-sky-500/70 bg-sky-100 text-sky-800 dark:bg-sky-500/10 dark:text-sky-100"
                : "border-slate-300 bg-slate-50 text-slate-600 hover:border-slate-400 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-950/50 dark:text-slate-400 dark:hover:border-slate-500 dark:hover:bg-slate-900/60"
            )}
          >
            <Upload className="h-8 w-8 opacity-70" strokeWidth={1.5} />
            <p className="text-sm">
              Drop files here or <span className="font-medium text-sky-400">choose files</span>
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-500">
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
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/40">
              <div className="grid grid-cols-5 gap-1.5 md:grid-cols-10">
                {pickedFiles.map((f, i) => (
                  <div key={`${f.name}-${f.size}-${i}`} className="w-full max-w-[64px]">
                    <PickedFilePreview
                      file={f}
                      onRemove={() => setPickedFiles((prev) => prev.filter((_, j) => j !== i))}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : editingUpdateId != null ? "Update" : "Post update"}
          </Button>
          {editingUpdateId != null ? (
            <Button
              type="button"
              variant="outline"
              className="border-slate-300 dark:border-slate-600"
              onClick={() => {
                setEditingUpdateId(null);
                setTitle("");
                setNotes("");
                setProjectId("");
                setGitRepoUrl("");
                setPickedFiles([]);
                setEditingAttachments([]);
                setEditingLegacyMedia([]);
                setError(null);
              }}
            >
              Cancel edit
            </Button>
          ) : null}
        </div>
      </form>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Recent updates
        </h2>
        {updates.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-600 dark:border-slate-700 dark:text-slate-500">
            No updates yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {updates.map((u) => (
              <li
                key={u.id}
                className="group relative rounded-xl border border-slate-200 bg-white transition hover:border-sky-300 hover:bg-sky-50/40 dark:border-slate-800 dark:bg-slate-900/40 dark:hover:border-sky-500/35 dark:hover:bg-slate-900/60"
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
                    <div className="font-medium text-slate-900 dark:text-white">{u.title}</div>
                    <div className="mt-1 text-xs text-slate-600 dark:text-slate-500">
                      Project: {projectName(u.projectId)}
                      {u.status ? ` · ${u.status}` : ""}
                      {u.createdAt ? ` · ${new Date(u.createdAt).toLocaleString()}` : ""}
                    </div>
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
                    {u.notes ? (
                      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{u.notes}</p>
                    ) : null}
                  </div>
                  <div className="relative z-10 flex shrink-0 gap-2 pointer-events-auto">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900"
                      onClick={() => {
                        setEditingUpdateId(u.id);
                        setTitle(u.title);
                        setNotes(u.notes ?? "");
                        setProjectId(u.projectId != null ? String(u.projectId) : "");
                        setGitRepoUrl(u.gitRepoUrl ?? "");
                        setPickedFiles([]);
                        setEditingAttachments(u.attachments ?? []);
                        setEditingLegacyMedia(buildLegacyMedia(u));
                        setError(null);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900"
                      onClick={() => void remove(u.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
