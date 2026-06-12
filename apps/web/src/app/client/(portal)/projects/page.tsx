"use client";

import { useCallback, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ApiFetchError, apiFetch } from "@/lib/api-fetch";

type Project = {
  id: number;
  name: string;
  description: string | null;
  createdAt: string | null;
};

export default function ClientProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await apiFetch.get<{ projects: Project[] }>("/api/client/projects");
    setProjects(data.projects);
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
    setSaving(true);
    setError(null);
    try {
      await apiFetch.post("/api/client/projects", {
        name: name.trim(),
        description: description.trim() || null
      });
      setName("");
      setDescription("");
      await load();
    } catch (err) {
      setError(err instanceof ApiFetchError ? err.message : "Could not add");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (deleteTargetId == null) return;
    try {
      await apiFetch.del(`/api/client/projects/${deleteTargetId}`);
      await load();
    } catch (err) {
      setError(err instanceof ApiFetchError ? err.message : "Delete failed");
    } finally {
      setDeleteTargetId(null);
    }
  }

  if (loading) {
    return <p className="text-slate-600 dark:text-slate-400">Loading…</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Projects</h1>
        <p className="mt-2 text-base text-slate-600 dark:text-slate-400">
          Create projects to organize your work updates.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      <form
        onSubmit={addProject}
        className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900/50"
      >
        <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">Add project</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-base text-slate-600 dark:text-slate-400">Name</label>
            <input
              className="form-input w-full border-slate-300 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g. Website redesign"
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className="text-base text-slate-600 dark:text-slate-400">Description (optional)</label>
            <textarea
              className="form-input min-h-[72px] w-full border-slate-300 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
        <Button type="submit" disabled={saving}>
          {saving ? "Adding…" : "Add project"}
        </Button>
      </form>

      <ul className="space-y-3">
        {projects.length === 0 ? (
          <li className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-base text-slate-600 dark:border-slate-700 dark:text-slate-500">
            No projects yet. Add one above.
          </li>
        ) : (
          projects.map((p) => (
            <li
              key={p.id}
              className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-900/40"
            >
              <div>
                <div className="font-medium text-slate-900 dark:text-white">{p.name}</div>
                {p.description ? (
                  <p className="mt-1 text-base text-slate-600 dark:text-slate-400">{p.description}</p>
                ) : null}
              </div>
              <button
                type="button"
                className="inline-flex min-w-[108px] whitespace-nowrap items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-800 transition-colors hover:border-slate-400 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60 disabled:pointer-events-none disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-slate-500 dark:hover:bg-slate-700"
                onClick={() => setDeleteTargetId(p.id)}
              >
                <Trash2 className="h-3.5 w-3.5 text-red-300" />
                Delete
              </button>
            </li>
          ))
        )}
      </ul>
      <ConfirmDialog
        open={deleteTargetId != null}
        title="Delete project?"
        description="Delete this project? Work updates linked to it will keep the update but lose the project link."
        confirmLabel="Delete"
        onCancel={() => setDeleteTargetId(null)}
        onConfirm={() => void remove()}
      />
    </div>
  );
}
