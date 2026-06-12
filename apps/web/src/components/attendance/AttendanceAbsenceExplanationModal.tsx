"use client";

import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PendingAbsenceExplanation } from "@/lib/attendance-absence-types";

type Props = {
  pending: PendingAbsenceExplanation;
  submitting: boolean;
  error: string | null;
  onSubmit: (reason: string) => void;
};

export function AttendanceAbsenceExplanationModal({
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
        aria-labelledby="absence-explanation-title"
        className="relative z-10 w-full max-w-lg rounded-2xl border border-rose-200/90 bg-white p-5 shadow-2xl dark:border-rose-800/80 dark:bg-slate-950"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
            <AlertCircle className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h2
              id="absence-explanation-title"
              className="text-lg font-semibold text-slate-900 dark:text-slate-100"
            >
              Absence explanation required
            </h2>
            <p className="mt-1 text-base text-slate-600 dark:text-slate-400">
              You were absent on a working day. Submit a reason before you can clock in.
            </p>
          </div>
        </div>

        <dl className="mt-4 rounded-xl border border-slate-200/90 bg-slate-50/80 p-3 text-sm dark:border-slate-700 dark:bg-slate-900/60">
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500 dark:text-slate-400">Absent date</dt>
            <dd className="font-medium text-slate-900 dark:text-slate-100">
              {pending.dateLabel}
            </dd>
          </div>
        </dl>

        <label className="mt-4 block space-y-1.5">
          <span className="text-base font-medium text-slate-700 dark:text-slate-300">
            Why were you absent?
          </span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="form-input min-h-[5rem] w-full resize-y py-2 text-sm"
            placeholder="Brief explanation for your manager…"
            minLength={3}
            maxLength={500}
            disabled={submitting}
            required
          />
        </label>

        {error ? (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : null}

        <div className="mt-5 flex justify-end">
          <Button
            type="button"
            disabled={submitting || reason.trim().length < 3}
            onClick={() => onSubmit(reason.trim())}
          >
            {submitting ? "Submitting…" : "Submit reason"}
          </Button>
        </div>
      </div>
    </div>
  );
}
