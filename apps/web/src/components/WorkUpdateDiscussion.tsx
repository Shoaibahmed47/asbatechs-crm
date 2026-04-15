"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiFetchError, apiFetch } from "@/lib/api-fetch";
import { Button } from "@/components/ui/button";

type WorkComment = {
  id: number;
  actorType: string;
  body: string;
  createdAt: string | null;
  userName: string | null;
  clientName: string | null;
};

type Props = {
  workUpdateId: number;
  canReview: boolean;
  initialStatus: string;
};

function labelForActor(c: WorkComment): string {
  if (c.actorType === "client") return c.clientName?.trim() || "Client";
  return c.userName?.trim() || "Employee";
}

export function WorkUpdateDiscussion({ workUpdateId, canReview, initialStatus }: Props) {
  const [comments, setComments] = useState<WorkComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(initialStatus);
  const [commentBody, setCommentBody] = useState("");
  const [reviewComment, setReviewComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadComments = useCallback(async () => {
    const res = await apiFetch.get<{ comments: WorkComment[] }>(`/api/work-updates/${workUpdateId}/comments`);
    setComments(res.comments);
  }, [workUpdateId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadComments();
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof ApiFetchError ? e.message : "Failed to load comments");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadComments]);

  async function postComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentBody.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch.post(`/api/work-updates/${workUpdateId}/comments`, {
        body: commentBody.trim()
      });
      setCommentBody("");
      await loadComments();
    } catch (e) {
      setError(e instanceof ApiFetchError ? e.message : "Could not post comment");
    } finally {
      setSaving(false);
    }
  }

  async function review(nextStatus: "in_review" | "changes_requested" | "approved") {
    setSaving(true);
    setError(null);
    try {
      await apiFetch.patch(`/api/client/work-updates/${workUpdateId}/status`, {
        status: nextStatus,
        comment: reviewComment.trim() || undefined
      });
      setStatus(nextStatus);
      setReviewComment("");
      await loadComments();
    } catch (e) {
      setError(e instanceof ApiFetchError ? e.message : "Could not update status");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-white">Discussion</h2>
        <span className="rounded-full bg-slate-800 px-2 py-1 text-xs text-slate-300">
          Status: {status}
        </span>
      </div>

      {canReview ? (
        <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/40 p-3">
          <p className="text-xs text-slate-400">Client review action</p>
          <textarea
            className="form-input min-h-[72px] w-full border-slate-700 bg-slate-950 text-white"
            placeholder="Add optional review comment"
            value={reviewComment}
            onChange={(e) => setReviewComment(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => void review("in_review")}>
              Mark in review
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => void review("changes_requested")}>
              Request changes
            </Button>
            <Button type="button" size="sm" onClick={() => void review("approved")}>
              Approve
            </Button>
          </div>
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      {loading ? (
        <p className="text-sm text-slate-500">Loading comments…</p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-slate-500">No comments yet.</p>
      ) : (
        <ul className="space-y-2">
          {comments.map((c) => (
            <li key={c.id} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="font-medium text-slate-300">{labelForActor(c)}</span>
                {c.createdAt ? <span>{new Date(c.createdAt).toLocaleString()}</span> : null}
              </div>
              <p className="mt-1 text-sm text-slate-300">{c.body}</p>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={postComment} className="space-y-2">
        <textarea
          className="form-input min-h-[80px] w-full border-slate-700 bg-slate-950 text-white"
          value={commentBody}
          onChange={(e) => setCommentBody(e.target.value)}
          placeholder="Write a comment"
        />
        <Button type="submit" size="sm" disabled={saving || !commentBody.trim()}>
          Post comment
        </Button>
      </form>
    </section>
  );
}
