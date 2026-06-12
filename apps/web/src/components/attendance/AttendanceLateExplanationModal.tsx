"use client";

import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PendingLateExplanation } from "@/lib/attendance-late-types";

type Props = {
  pending: PendingLateExplanation;
  submitting: boolean;
  error: string | null;
  onSubmit: (reason: string) => void;
};

function formatLateDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  if (rem === 0) return `${hours} hour${hours === 1 ? "" : "s"}`;
  return `${hours}h ${rem}m`;
}

export function AttendanceLateExplanationModal({
  pending,
  submitting,
  error,
  onSubmit
}: Props) {
  const [reason, setReason] = useState("");

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]" aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="late-explanation-title"
        className="relative z-10 w-full max-w-lg rounded-2xl border border-amber-200/90 bg-white p-5 shadow-2xl dark:border-amber-800/80 dark:bg-slate-950"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            <AlertCircle className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h2
              id="late-explanation-title"
              className="text-lg font-semibold text-slate-900 dark:text-slate-100"
            >
              Late arrival explanation required
            </h2>
            <p className="mt-1 text-base text-slate-600 dark:text-slate-400">
              You arrived late and must submit a reason before you can clock in again.
            </p>
          </div>
        </div>

        <dl className="mt-4 grid gap-2 rounded-xl border border-slate-200/90 bg-slate-50/80 p-3 text-sm dark:border-slate-700 dark:bg-slate-900/60">
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500 dark:text-slate-400">Date</dt>
            <dd className="font-medium text-slate-900 dark:text-slate-100">
              {pending.dateLabel}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500 dark:text-slate-400">Expected check-in</dt>
            <dd className="font-medium text-slate-900 dark:text-slate-100">
              {pending.expectedCheckInLabel}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500 dark:text-slate-400">Your check-in</dt>
            <dd className="font-medium text-slate-900 dark:text-slate-100">
              {pending.clockInLabel}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500 dark:text-slate-400">Late by</dt>
            <dd className="font-semibold text-amber-800 dark:text-amber-300">
              {formatLateDuration(pending.lateMinutes)}
            </dd>
          </div>
        </dl>

        <label className="mt-4 block">
          <span className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Why were you late?
          </span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            maxLength={500}
            disabled={submitting}
            placeholder="Example: traffic, family emergency, doctor appointment..."
            className="form-input mt-1.5 min-h-[6rem] resize-y"
          />
        </label>

        {error ? (
          <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{error}</p>
        ) : null}

        <div className="mt-4 flex justify-end">
          <Button
            type="button"
            disabled={submitting || reason.trim().length < 3}
            onClick={() => onSubmit(reason.trim())}
          >
            {submitting ? "Submitting..." : "Submit reason"}
          </Button>
        </div>

        <p className="mt-3 text-base text-slate-500 dark:text-slate-400">
          This explanation is shared with your manager. You cannot clock in until you
          submit.
        </p>
      </div>
    </div>
  );
}
