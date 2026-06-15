"use client";

import { useState } from "react";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatAttendanceDurationReadable } from "@/lib/attendance-date";
import type { PendingEarlyLeaveExplanation } from "@/lib/attendance-early-leave-types";

type Props = {
  pending: PendingEarlyLeaveExplanation;
  submitting: boolean;
  error: string | null;
  onSubmit: (reason: string) => void;
};

export function AttendanceEarlyLeaveExplanationModal({
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
        aria-labelledby="early-leave-explanation-title"
        className="relative z-10 w-full max-w-lg rounded-2xl border border-sky-200/90 bg-white p-5 shadow-2xl dark:border-sky-800/80 dark:bg-slate-950"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300">
            <Clock className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h2
              id="early-leave-explanation-title"
              className="text-lg font-semibold text-slate-900 dark:text-slate-100"
            >
              Early leave explanation required
            </h2>
            <p className="mt-1 text-base text-slate-600 dark:text-slate-400">
              You left before shift end on a previous day. Submit a reason before you can
              clock in again.
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
            <dt className="text-slate-500 dark:text-slate-400">Expected shift end</dt>
            <dd className="font-medium text-slate-900 dark:text-slate-100">
              {pending.expectedShiftEndLabel}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500 dark:text-slate-400">Your clock-out</dt>
            <dd className="font-medium text-slate-900 dark:text-slate-100">
              {pending.clockOutLabel}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500 dark:text-slate-400">Left early by</dt>
            <dd className="font-semibold text-sky-800 dark:text-sky-300">
              {formatAttendanceDurationReadable(pending.earlyLeaveMinutes)}
            </dd>
          </div>
        </dl>

        <label className="mt-4 block">
          <span className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Why did you leave early?
          </span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            maxLength={500}
            disabled={submitting}
            placeholder="Example: doctor appointment, family emergency, approved half day..."
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
