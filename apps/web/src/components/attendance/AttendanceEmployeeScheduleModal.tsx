"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Clock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApiFetchError, apiFetch } from "@/lib/api-fetch";
import { formatOfficeTimeLabel } from "@/lib/attendance-office-hours";
import {
  type AnchorRect,
  computeAnchoredPopoverPosition
} from "@/lib/anchored-popover";
import { clearInteractionLocks } from "@/lib/dom-interaction-locks";

export type ScheduleAnchorRect = AnchorRect;

const POPOVER_ID = "attendance-employee-schedule-popover";
const POPOVER_WIDTH = 24 * 16;

type Props = {
  userId: number;
  userName: string;
  anchorRect: AnchorRect;
  onClose: () => void;
  onSaved: () => void;
};

type Schedule = {
  employeeExpectedCheckInTime: string | null;
  officeExpectedCheckInTime: string;
  effectiveExpectedCheckInTime: string;
  effectiveExpectedCheckInLabel: string;
  usesOfficeDefault: boolean;
};

export function AttendanceEmployeeScheduleModal({
  userId,
  userName,
  anchorRect,
  onClose,
  onSaved
}: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [checkInTime, setCheckInTime] = useState("19:00");
  const [useOfficeDefault, setUseOfficeDefault] = useState(true);
  const [popoverPos, setPopoverPos] = useState(() =>
    computeAnchoredPopoverPosition(anchorRect, POPOVER_WIDTH, 320)
  );
  const anchorRef = useRef(anchorRect);
  const onCloseRef = useRef(onClose);

  anchorRef.current = anchorRect;
  onCloseRef.current = onClose;

  useLayoutEffect(() => {
    setPopoverPos(computeAnchoredPopoverPosition(anchorRef.current, POPOVER_WIDTH, 320));
    clearInteractionLocks();
  }, [anchorRect]);

  useLayoutEffect(() => {
    function updatePosition() {
      setPopoverPos(computeAnchoredPopoverPosition(anchorRef.current, POPOVER_WIDTH, 320));
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

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiFetch<{ schedule: Schedule }>(
          `/api/admin/attendance/employee-schedule?userId=${userId}`
        );
        if (cancelled) return;
        setSchedule(data.schedule);
        setUseOfficeDefault(data.schedule.usesOfficeDefault);
        setCheckInTime(
          data.schedule.employeeExpectedCheckInTime ??
            data.schedule.officeExpectedCheckInTime
        );
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiFetchError ? err.message : "Could not load employee schedule."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  function handleOfficeDefaultChange(checked: boolean) {
    setUseOfficeDefault(checked);
    if (checked && schedule) {
      setCheckInTime(schedule.officeExpectedCheckInTime);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const data = await apiFetch.put<{ schedule: Schedule }>(
        "/api/admin/attendance/employee-schedule",
        {
          userId,
          expectedCheckInTime: useOfficeDefault ? null : checkInTime
        }
      );
      setSchedule(data.schedule);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiFetchError ? err.message : "Could not save schedule.");
    } finally {
      setSaving(false);
    }
  }

  if (typeof document === "undefined") return null;

  const officeLabel = schedule
    ? formatOfficeTimeLabel(schedule.officeExpectedCheckInTime)
    : formatOfficeTimeLabel(checkInTime);

  const panel = (
    <div
      id={POPOVER_ID}
      role="dialog"
      aria-modal="true"
      aria-labelledby="schedule-popover-title"
      style={{
        position: "fixed",
        top: popoverPos.top,
        left: popoverPos.left,
        width: Math.min(POPOVER_WIDTH, window.innerWidth - 24),
        maxWidth: "calc(100vw - 24px)",
        zIndex: 120
      }}
      className="rounded-2xl border border-sky-200/90 bg-white p-5 shadow-[0_20px_50px_rgba(15,23,42,0.18)] dark:border-sky-800/70 dark:bg-slate-950"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300">
          <Clock className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h3
            id="schedule-popover-title"
            className="text-base font-semibold text-slate-900 dark:text-slate-100"
          >
            Employee check-in time
          </h3>
          <p className="mt-1 text-base text-slate-600 dark:text-slate-400">{userName}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close check-in schedule"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-slate-500">Loading…</p>
      ) : (
        <div className="mt-4 space-y-3">
          <label
            className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
              useOfficeDefault
                ? "border-sky-300/80 bg-sky-50/80 dark:border-sky-700/70 dark:bg-sky-950/35"
                : "border-slate-200/90 bg-slate-50/50 dark:border-slate-700 dark:bg-slate-900/40"
            }`}
          >
            <input
              type="checkbox"
              checked={useOfficeDefault}
              onChange={(e) => handleOfficeDefaultChange(e.target.checked)}
              disabled={saving}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
            />
            <span className="min-w-0">
              <span className="text-base font-medium text-slate-900 dark:text-slate-100">
                Use office default time
              </span>
              <span className="mt-0.5 block text-base leading-relaxed text-slate-500 dark:text-slate-400">
                Follow office check-in from Admin Control — no separate time for this employee.
              </span>
            </span>
          </label>

          {useOfficeDefault ? (
            <div className="rounded-xl border border-slate-200/90 bg-slate-50/80 px-3 py-3 dark:border-slate-700 dark:bg-slate-900/60">
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Effective check-in
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-sky-800 dark:text-sky-300">
                {officeLabel}
              </p>
              <p className="mt-1 text-base text-slate-500 dark:text-slate-400">
                Office default · late grace applies from this time
              </p>
            </div>
          ) : (
            <label className="block rounded-xl border border-slate-200/90 bg-white p-3 dark:border-slate-700 dark:bg-slate-900/60">
              <span className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Custom check-in for this employee
              </span>
              <input
                type="time"
                value={checkInTime}
                onChange={(e) => setCheckInTime(e.target.value)}
                disabled={saving}
                className="form-input mt-2"
              />
              <span className="mt-1 block text-base text-slate-500 dark:text-slate-400">
                {formatOfficeTimeLabel(checkInTime)} · overrides office default
              </span>
            </label>
          )}
        </div>
      )}

      {error ? <p className="mt-3 text-sm text-rose-600 dark:text-rose-400">{error}</p> : null}

      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => void handleSave()}
          disabled={loading || saving}
        >
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );

  return createPortal(panel, document.body);
}
