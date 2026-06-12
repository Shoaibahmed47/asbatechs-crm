"use client";

import { useState } from "react";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatAttendanceClock } from "@/lib/attendance-date";
import { formatBreakCategoryLabel } from "@/lib/attendance-break-shared";

type Props = {
  breakStart: string | null;
  breakCategory: string | null;
  startNote: string | null;
  submitting: boolean;
  error: string | null;
  onSubmit: (endNote: string) => void;
};

export function AttendanceEndBreakModal({
  breakStart,
  breakCategory,
  startNote,
  submitting,
  error,
  onSubmit
}: Props) {
  const [endNote, setEndNote] = useState("");

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]" aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-lg rounded-2xl border border-emerald-200/90 bg-white p-5 shadow-2xl dark:border-emerald-800/80 dark:bg-slate-950"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
            <MapPin className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              End break
            </h2>
            <p className="mt-1 text-base text-slate-600 dark:text-slate-400">
              Tell your manager where you went and what you did before resuming work.
            </p>
          </div>
        </div>

        <dl className="mt-4 grid gap-2 rounded-xl border border-slate-200/90 bg-slate-50/80 p-3 text-sm dark:border-slate-700 dark:bg-slate-900/60">
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500 dark:text-slate-400">Break type</dt>
            <dd className="font-medium text-slate-900 dark:text-slate-100">
              {formatBreakCategoryLabel(breakCategory)}
            </dd>
          </div>
          {startNote?.trim() ? (
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500 dark:text-slate-400">Start note</dt>
              <dd className="text-right font-medium text-slate-900 dark:text-slate-100">
                {startNote}
              </dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500 dark:text-slate-400">Started at</dt>
            <dd className="font-medium text-slate-900 dark:text-slate-100">
              {breakStart ? formatAttendanceClock(breakStart) : "—"}
            </dd>
          </div>
        </dl>

        <label className="mt-4 block space-y-1.5">
          <span className="text-base font-medium text-slate-700 dark:text-slate-300">
            Where did you go / what did you do?
          </span>
          <textarea
            value={endNote}
            onChange={(e) => setEndNote(e.target.value)}
            rows={4}
            maxLength={500}
            disabled={submitting}
            placeholder="Example: had lunch at home, prayed at mosque, short walk…"
            className="form-input min-h-[5.5rem] w-full resize-y py-2 text-sm"
            required
          />
        </label>

        {error ? <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{error}</p> : null}

        <div className="mt-5 flex justify-end">
          <Button
            type="button"
            disabled={submitting || endNote.trim().length < 3}
            onClick={() => onSubmit(endNote.trim())}
          >
            {submitting ? "Ending…" : "End break"}
          </Button>
        </div>
      </div>
    </div>
  );
}
