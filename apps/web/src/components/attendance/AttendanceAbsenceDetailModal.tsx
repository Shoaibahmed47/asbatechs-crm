"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarX, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  type AnchorRect,
  computeAnchoredPopoverPosition
} from "@/lib/anchored-popover";
import { formatAttendanceDateTime } from "@/lib/attendance-date";
import { clearInteractionLocks } from "@/lib/dom-interaction-locks";

const POPOVER_ID = "attendance-absence-detail-popover";
const POPOVER_WIDTH = 22 * 16;

export type AdminAbsenceDetail = {
  userName: string;
  dateLabel: string;
  absenceReason: string | null;
  absenceReasonSubmittedAt: string | null;
};

type Props = {
  detail: AdminAbsenceDetail;
  anchorRect: AnchorRect;
  onClose: () => void;
};

function formatSubmittedAt(value: string | null): string {
  if (!value) return "Not submitted yet";
  return formatAttendanceDateTime(value);
}

export function AttendanceAbsenceDetailModal({ detail, anchorRect, onClose }: Props) {
  const [popoverPos, setPopoverPos] = useState(() =>
    computeAnchoredPopoverPosition(anchorRect, POPOVER_WIDTH)
  );
  const anchorRef = useRef(anchorRect);
  const onCloseRef = useRef(onClose);

  anchorRef.current = anchorRect;
  onCloseRef.current = onClose;

  const hasReason = Boolean(detail.absenceReason?.trim());

  useLayoutEffect(() => {
    setPopoverPos(computeAnchoredPopoverPosition(anchorRef.current, POPOVER_WIDTH));
    clearInteractionLocks();
  }, [anchorRect]);

  useLayoutEffect(() => {
    function updatePosition() {
      setPopoverPos(computeAnchoredPopoverPosition(anchorRef.current, POPOVER_WIDTH));
    }

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, []);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      const popover = document.getElementById(POPOVER_ID);
      if (popover?.contains(target)) return;
      onCloseRef.current();
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onCloseRef.current();
    }

    const attachTimer = window.setTimeout(() => {
      document.addEventListener("pointerdown", onPointerDown, true);
    }, 0);

    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(attachTimer);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
      clearInteractionLocks();
    };
  }, []);

  if (typeof document === "undefined") return null;

  const panel = (
    <div
      id={POPOVER_ID}
      role="dialog"
      aria-modal="true"
      aria-labelledby="absence-detail-title"
      style={{
        position: "fixed",
        top: popoverPos.top,
        left: popoverPos.left,
        width: Math.min(POPOVER_WIDTH, window.innerWidth - 24),
        maxWidth: "calc(100vw - 24px)",
        zIndex: 120
      }}
      className="rounded-2xl border border-rose-200/90 bg-white p-5 shadow-[0_20px_50px_rgba(15,23,42,0.18)] dark:border-rose-900/60 dark:bg-slate-950"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/50 dark:text-rose-300">
          <CalendarX className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h3
            id="absence-detail-title"
            className="text-base font-semibold text-slate-900 dark:text-slate-100"
          >
            Absence details
          </h3>
          <p className="mt-1 text-base text-slate-600 dark:text-slate-400">{detail.userName}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close absence details"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex rounded-full px-2.5 py-0.5 text-sm font-semibold uppercase tracking-wide ${
            hasReason
              ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300"
              : "bg-rose-500/15 text-rose-800 dark:text-rose-300"
          }`}
        >
          {hasReason ? "Reason submitted" : "Pending"}
        </span>
      </div>

      <dl className="mt-4 grid gap-2 rounded-xl border border-slate-200/90 bg-slate-50/80 p-3 text-sm dark:border-slate-700 dark:bg-slate-900/60">
        <div className="flex justify-between gap-3">
          <dt className="text-slate-500 dark:text-slate-400">Absent date</dt>
          <dd className="font-medium text-slate-900 dark:text-slate-100">{detail.dateLabel}</dd>
        </div>
      </dl>

      <div className="mt-4 rounded-xl border border-slate-200/90 bg-white p-3 dark:border-slate-700 dark:bg-slate-900/60">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Employee reason
        </p>
        <p className="mt-2 text-base leading-relaxed text-slate-800 dark:text-slate-200">
          {hasReason
            ? detail.absenceReason
            : "Pending — employee has not submitted a reason yet."}
        </p>
        <p className="mt-2 text-base text-slate-500 dark:text-slate-400">
          Submitted: {formatSubmittedAt(detail.absenceReasonSubmittedAt)}
        </p>
      </div>

      <div className="mt-4 flex justify-end">
        <Button type="button" size="sm" onClick={onClose}>Close</Button>
      </div>
    </div>
  );

  return createPortal(panel, document.body);
}
