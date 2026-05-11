"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiFetchError, apiFetch } from "@/lib/api-fetch";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type WorkComment = {
  id: number;
  actorType: string;
  body: string;
  createdAt: string | null;
  userName: string | null;
  userEmail: string | null;
  clientName: string | null;
  clientEmail: string | null;
};

type Props = {
  workUpdateId: number;
  canReview: boolean;
  initialStatus: string;
};

function normalizedActorType(actorType: string): string {
  if (actorType === "user") return "employee";
  return actorType;
}

function authorBadgeClass(actorType: string) {
  const t = normalizedActorType(actorType);
  if (t === "client") {
    return "bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200";
  }
  if (t === "employee") {
    return "bg-violet-100 text-violet-800 dark:bg-violet-900/45 dark:text-violet-200";
  }
  if (t === "admin") {
    return "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100";
  }
  if (t === "manager") {
    return "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100";
  }
  return "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200";
}

function authorBadgeLabel(actorType: string) {
  const t = normalizedActorType(actorType);
  if (t === "client") return "CLIENT";
  if (t === "employee") return "EMPLOYEE";
  if (t === "admin") return "ADMIN";
  if (t === "manager") return "MANAGER";
  return "COMMENT";
}

/** How many newest comments stay visible when history is collapsed. */
const RECENT_COMMENTS_VISIBLE = 5;

function displayAuthor(c: WorkComment): string {
  if (c.actorType === "client") {
    const email = c.clientEmail?.trim();
    const name = c.clientName?.trim();
    if (email && name && email.toLowerCase() !== name.toLowerCase()) {
      return `${name} · ${email}`;
    }
    return email || name || "Client";
  }
  const email = c.userEmail?.trim();
  const name = c.userName?.trim();
  if (email && name && email.toLowerCase() !== name.toLowerCase()) {
    return `${name} · ${email}`;
  }
  return email || name || "Team member";
}

export function WorkUpdateDiscussion({ workUpdateId, canReview, initialStatus }: Props) {
  const [comments, setComments] = useState<WorkComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(initialStatus);
  const [commentBody, setCommentBody] = useState("");
  const [reviewComment, setReviewComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFullHistory, setShowFullHistory] = useState(false);

  useEffect(() => {
    setShowFullHistory(false);
  }, [workUpdateId]);

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

  const discussionCanCollapse = comments.length > RECENT_COMMENTS_VISIBLE;
  const discussionVisibleComments =
    !discussionCanCollapse || showFullHistory
      ? comments
      : comments.slice(-RECENT_COMMENTS_VISIBLE);
  const discussionHiddenOlderCount = comments.length - discussionVisibleComments.length;

  const fieldClass =
    "form-input w-full border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-500";

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-900 dark:text-white">Discussion</h2>
        <span className="rounded-full bg-slate-200 px-2 py-1 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">
          Status: {status}
        </span>
      </div>

      {canReview ? (
        <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/40">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Client review action</p>
          <textarea
            className={`${fieldClass} min-h-[72px]`}
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

      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

      {loading ? (
        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Loading comments…</p>
      ) : comments.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
          No comments yet.
        </p>
      ) : (
        <div className="space-y-2">
          {discussionCanCollapse && !showFullHistory && discussionHiddenOlderCount > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              onClick={() => setShowFullHistory(true)}
            >
              Show more
              <span className="ml-1.5 font-normal text-slate-500 dark:text-slate-400">
                ({discussionHiddenOlderCount} earlier{" "}
                {discussionHiddenOlderCount === 1 ? "message" : "messages"})
              </span>
            </Button>
          ) : null}
          {discussionCanCollapse && showFullHistory ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full border-transparent bg-transparent text-slate-600 shadow-none hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200"
              onClick={() => setShowFullHistory(false)}
            >
              Show less
            </Button>
          ) : null}
          <ul className="space-y-2">
            {discussionVisibleComments.map((c) => (
              <li
                key={c.id}
                className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/40"
              >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide",
                      authorBadgeClass(c.actorType)
                    )}
                  >
                    {authorBadgeLabel(c.actorType)}
                  </span>
                  <span className="text-xs font-medium text-slate-800 dark:text-slate-100">{displayAuthor(c)}</span>
                  {c.createdAt ? (
                    <>
                      <span className="hidden text-slate-400 sm:inline dark:text-slate-600" aria-hidden>
                        ·
                      </span>
                      <time
                        dateTime={c.createdAt}
                        className="text-xs font-medium tabular-nums text-slate-500 dark:text-slate-400 sm:ml-0"
                      >
                        {new Date(c.createdAt).toLocaleString()}
                      </time>
                    </>
                  ) : null}
                </div>
                <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">{c.body}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={postComment} className="space-y-2">
        <textarea
          className={`${fieldClass} min-h-[80px]`}
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
