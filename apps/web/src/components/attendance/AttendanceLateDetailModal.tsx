"use client";

import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatAttendanceDateTime } from "@/lib/attendance-date";

export type AdminLateDetail = {
  userName: string;
  date: string;
  dateLabel: string;
  expectedCheckInLabel: string;
  clockInLabel: string;
  lateMinutes: number;
  lateReason: string | null;
  lateReasonSubmittedAt: string | null;
};

type Props = {
  detail: AdminLateDetail;
  onClose: () => void;
};

function formatLateDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  if (rem === 0) return `${hours} hour${hours === 1 ? "" : "s"}`;
  return `${hours}h ${rem}m`;
}

function formatSubmittedAt(iso: string | null): string {
  if (!iso) return "Not submitted yet";
  return formatAttendanceDateTime(iso);
}

export function AttendanceLateDetailModal({ detail, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/45 backdrop-blur-[1px]"
        aria-label="Close late detail dialog"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-lg rounded-2xl border border-amber-200/90 bg-white p-5 shadow-2xl dark:border-amber-800/80 dark:bg-slate-950"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            <AlertCircle className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Late arrival details
            </h3>
            <p className="mt-1 text-base text-slate-600 dark:text-slate-400">{detail.userName}</p>
          </div>
        </div>

        <dl className="mt-4 grid gap-2 rounded-xl border border-slate-200/90 bg-slate-50/80 p-3 text-sm dark:border-slate-700 dark:bg-slate-900/60">
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500 dark:text-slate-400">Date</dt>
            <dd className="font-medium text-slate-900 dark:text-slate-100">{detail.dateLabel}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500 dark:text-slate-400">Expected check-in</dt>
            <dd className="font-medium text-slate-900 dark:text-slate-100">
              {detail.expectedCheckInLabel}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500 dark:text-slate-400">Actual check-in</dt>
            <dd className="font-medium text-slate-900 dark:text-slate-100">{detail.clockInLabel}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500 dark:text-slate-400">Late by</dt>
            <dd className="font-semibold text-amber-800 dark:text-amber-300">
              {formatLateDuration(detail.lateMinutes)}
            </dd>
          </div>
        </dl>

        <div className="mt-4 rounded-xl border border-slate-200/90 bg-white p-3 dark:border-slate-700 dark:bg-slate-900/60">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Employee reason
          </p>
          <p className="mt-2 text-base text-slate-800 dark:text-slate-200">
            {detail.lateReason?.trim() ? detail.lateReason : "Pending — employee has not submitted yet."}
          </p>
          <p className="mt-2 text-base text-slate-500 dark:text-slate-400">
            Submitted: {formatSubmittedAt(detail.lateReasonSubmittedAt)}
          </p>
        </div>

        <div className="mt-4 flex justify-end">
          <Button type="button" size="sm" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}
