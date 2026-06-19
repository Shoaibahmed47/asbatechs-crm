"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Coffee } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  BREAK_CATEGORIES,
  BREAK_CATEGORY_LABELS,
  type BreakCategory
} from "@/lib/attendance-break-shared";

type Props = {
  submitting: boolean;
  error: string | null;
  onSubmit: (payload: { category: BreakCategory; note?: string }) => void;
  onCancel: () => void;
};

export function AttendanceStartBreakModal({
  submitting,
  error,
  onSubmit,
  onCancel
}: Props) {
  const [category, setCategory] = useState<BreakCategory>("lunch");
  const [otherNote, setOtherNote] = useState("");
  const [mounted, setMounted] = useState(false);
  const isOther = category === "other";
  const canSubmit = !isOther || otherNote.trim().length >= 3;

  useEffect(() => {
    setMounted(true);
  }, []);

  const panel = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]"
        aria-label="Close dialog"
        onClick={onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-lg rounded-2xl border border-sky-200/90 bg-white p-5 shadow-2xl dark:border-sky-800/80 dark:bg-slate-950"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300">
            <Coffee className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Start break
            </h2>
            <p className="mt-1 text-base text-slate-600 dark:text-slate-400">
              Select your break type. Start time, end time, and duration are recorded
              automatically when you click{" "}
              <strong className="font-semibold text-slate-800 dark:text-slate-200">
                End break
              </strong>
              .
            </p>
          </div>
        </div>

        <label className="mt-4 block space-y-1.5">
          <span className="text-base font-medium text-slate-700 dark:text-slate-300">
            Break type
          </span>
          <select
            value={category}
            onChange={(e) => {
              const next = e.target.value as BreakCategory;
              setCategory(next);
              if (next !== "other") setOtherNote("");
            }}
            disabled={submitting}
            className="form-input w-full"
          >
            {BREAK_CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {BREAK_CATEGORY_LABELS[value]}
              </option>
            ))}
          </select>
          <span className="text-base text-slate-500 dark:text-slate-400">
            Your manager sees this on the break report with start, end, and duration.
          </span>
        </label>

        {isOther ? (
          <label className="mt-3 block space-y-1.5">
            <span className="text-base font-medium text-slate-700 dark:text-slate-300">
              Where are you going / what will you do?
            </span>
            <textarea
              value={otherNote}
              onChange={(e) => setOtherNote(e.target.value)}
              rows={3}
              maxLength={240}
              disabled={submitting}
              placeholder="Example: quick errand, doctor visit, family call…"
              className="form-input min-h-[4.5rem] w-full resize-y py-2 text-sm"
              required
            />
            <span className="text-base text-slate-500 dark:text-slate-400">
              Required for Other — your manager sees this on the break report.
            </span>
          </label>
        ) : null}

        {error ? <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{error}</p> : null}

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" size="sm" variant="outline" disabled={submitting} onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={submitting || !canSubmit}
            onClick={() =>
              onSubmit({
                category,
                ...(isOther ? { note: otherNote.trim() } : {})
              })
            }
          >
            {submitting ? "Starting…" : "Start break"}
          </Button>
        </div>
      </div>
    </div>
  );

  if (!mounted || typeof document === "undefined") return null;
  return createPortal(panel, document.body);
}
