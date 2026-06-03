"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { DayPicker, type DateRange } from "react-day-picker";
import { format } from "date-fns";
import { CalendarDays, ChevronDown } from "lucide-react";
import "react-day-picker/dist/style.css";

import { Button } from "@/components/ui/button";
import { ATTENDANCE_TIME_ZONE, getLocalDateString } from "@/lib/attendance-date";
import { cn } from "@/lib/utils";

type PopoverPosition = {
  top: number;
  left: number;
  maxHeight: number;
};

type Props = {
  from: string;
  to: string;
  activeDate: string;
  onRangeChange: (from: string, to: string) => void;
  onActiveDateChange: (iso: string) => void;
  /** Full date bar above grid, or compact buttons beside section header */
  variant?: "bar" | "compact";
  /**
   * inline = expands inside the page (drawers). popover = dropdown (employee page).
   */
  display?: "popover" | "inline";
  popoverAlign?: "start" | "end" | "center";
  numberOfMonths?: 1 | 2;
  /** Stack months vertically (detail drawer — no horizontal scroll). */
  stackMonths?: boolean;
  /** Left side of compact toolbar (e.g. section title beside Show calendar). */
  headerStart?: ReactNode;
  /** When true, selecting an end date applies the range immediately. */
  autoApply?: boolean;
};

const VIEWPORT_PAD = 12;
const ESTIMATED_POPOVER_HEIGHT = 480;

function toDate(iso: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return undefined;
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function toIso(d?: Date): string {
  if (!d) return "";
  return format(d, "yyyy-MM-dd");
}

function formatDayLabel(iso: string): string {
  const d = toDate(iso);
  if (!d) return "—";
  return d.toLocaleDateString(undefined, {
    timeZone: ATTENDANCE_TIME_ZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

export function formatAttendanceRangeLabel(from: string, to: string): string {
  const f = toDate(from);
  const t = toDate(to);
  if (!f || !t) return "Pick a date range";
  const opts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric"
  };
  if (from === to) {
    return f.toLocaleDateString(undefined, {
      timeZone: ATTENDANCE_TIME_ZONE,
      weekday: "short",
      ...opts
    });
  }
  return `${f.toLocaleDateString(undefined, {
    timeZone: ATTENDANCE_TIME_ZONE,
    ...opts
  })} – ${t.toLocaleDateString(undefined, {
    timeZone: ATTENDANCE_TIME_ZONE,
    ...opts
  })}`;
}

function computePopoverPosition(
  anchor: DOMRect,
  popoverWidth: number,
  align: "start" | "end" | "center"
): PopoverPosition {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const width = Math.min(popoverWidth, vw - VIEWPORT_PAD * 2);
  let left =
    align === "center"
      ? anchor.left + anchor.width / 2 - width / 2
      : align === "start"
        ? anchor.left
        : anchor.right - width;
  left = Math.max(VIEWPORT_PAD, Math.min(left, vw - width - VIEWPORT_PAD));

  const spaceBelow = vh - anchor.bottom - VIEWPORT_PAD;
  const spaceAbove = anchor.top - VIEWPORT_PAD;
  const openBelow = spaceBelow >= Math.min(ESTIMATED_POPOVER_HEIGHT, spaceAbove);

  let top = openBelow ? anchor.bottom + 8 : anchor.top - 8;
  let maxHeight = openBelow ? spaceBelow - 8 : spaceAbove - 8;

  if (!openBelow) {
    top = Math.max(VIEWPORT_PAD, top - ESTIMATED_POPOVER_HEIGHT);
    maxHeight = anchor.top - VIEWPORT_PAD - 8;
  }

  maxHeight = Math.max(240, Math.min(maxHeight, vh - VIEWPORT_PAD * 2));
  top = Math.max(VIEWPORT_PAD, Math.min(top, vh - maxHeight - VIEWPORT_PAD));

  return { top, left, maxHeight };
}

export function AttendanceDateRangeCalendar({
  from,
  to,
  activeDate,
  onRangeChange,
  onActiveDateChange,
  variant = "bar",
  display,
  popoverAlign = "center",
  numberOfMonths = 2,
  stackMonths = false,
  headerStart,
  autoApply = true
}: Props) {
  /** Compact controls sit in narrow cards — inline avoids viewport clipping. */
  const resolvedDisplay = display ?? (variant === "compact" ? "inline" : "popover");
  const [open, setOpen] = useState(false);
  const [calendarKey, setCalendarKey] = useState(0);
  const [draftRange, setDraftRange] = useState<DateRange | undefined>();
  const [popoverPos, setPopoverPos] = useState<PopoverPosition | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const today = getLocalDateString();
  const isToday = from === today && to === today && activeDate === today;
  const popoverWidth = numberOfMonths === 1 ? 300 : 560;

  const draftFrom = draftRange?.from ? toIso(draftRange.from) : "";
  const draftTo = draftRange?.to ? toIso(draftRange.to) : "";
  const canApply = Boolean(draftFrom && draftTo);

  function closePicker() {
    if (resolvedDisplay === "inline") return;
    setOpen(false);
    setDraftRange(undefined);
  }

  function openPicker() {
    setCalendarKey((k) => k + 1);
    setDraftRange(undefined);
    setOpen(true);
  }

  function toggleInline() {
    setOpen((prev) => {
      const next = !prev;
      if (next) setCalendarKey((k) => k + 1);
      else setDraftRange(undefined);
      return next;
    });
  }

  function applyDraftRange() {
    if (!draftFrom || !draftTo) return;
    const normalizedFrom = draftFrom <= draftTo ? draftFrom : draftTo;
    const normalizedTo = draftFrom <= draftTo ? draftTo : draftFrom;
    onRangeChange(normalizedFrom, normalizedTo);
    onActiveDateChange(normalizedTo);
    if (resolvedDisplay === "popover") closePicker();
  }

  useEffect(() => {
    if (!open || resolvedDisplay !== "popover" || !rootRef.current) {
      setPopoverPos(null);
      return;
    }

    function updatePosition() {
      const el = rootRef.current;
      if (!el) return;
      setPopoverPos(computePopoverPosition(el.getBoundingClientRect(), popoverWidth, popoverAlign));
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, resolvedDisplay, popoverAlign, popoverWidth]);

  useEffect(() => {
    if (!open || resolvedDisplay !== "popover") return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      const popover = document.getElementById("attendance-range-popover");
      if (popover?.contains(target)) return;
      closePicker();
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closePicker();
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, display]);

  const pickerBody = (
    <>
      <div className="rounded-xl border border-sky-200/80 bg-sky-50/90 px-3 py-2.5 dark:border-sky-800/60 dark:bg-sky-950/40">
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Pick date range</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
          {autoApply ? "1. Click start day · 2. Click end day (auto apply)" : "1. Click start day · 2. Click end day · 3. Apply range"}
        </p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-700 dark:text-slate-300">
          <span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">Start:</span>{" "}
            {draftFrom ? formatDayLabel(draftFrom) : "—"}
          </span>
          <span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">End:</span>{" "}
            {draftTo ? formatDayLabel(draftTo) : "—"}
          </span>
        </div>
      </div>

      <div
        className={cn(
          "mt-3 flex justify-center pb-1",
          resolvedDisplay === "inline" ? "w-full" : !stackMonths && "overflow-x-auto"
        )}
      >
        <DayPicker
          key={calendarKey}
          className={cn(
            "attendance-range-picker",
            resolvedDisplay === "inline" && "attendance-range-picker--inline",
            stackMonths && "attendance-range-picker--stacked"
          )}
          classNames={{
            months: cn(
              "flex justify-center gap-8",
              stackMonths ? "flex-col items-center" : "flex-row flex-nowrap"
            ),
            month: "w-auto shrink-0",
            caption_label: "text-sm font-semibold text-slate-900 dark:text-slate-100",
            day: "text-sm"
          }}
          mode="range"
          numberOfMonths={numberOfMonths}
          selected={draftRange}
          defaultMonth={toDate(to) ?? toDate(from) ?? new Date()}
          onSelect={(next) => {
            if (!next?.from) {
              setDraftRange(undefined);
              return;
            }
            setDraftRange(next);
            if (autoApply && next.to) {
              const nextFromIso = toIso(next.from);
              const nextToIso = toIso(next.to);
              if (!nextFromIso || !nextToIso) return;
              const normalizedFrom = nextFromIso <= nextToIso ? nextFromIso : nextToIso;
              const normalizedTo = nextFromIso <= nextToIso ? nextToIso : nextFromIso;
              onRangeChange(normalizedFrom, normalizedTo);
              onActiveDateChange(normalizedTo);
            }
          }}
          modifiers={{
            active_view: toDate(activeDate) ? [toDate(activeDate)!] : []
          }}
          modifiersClassNames={{
            active_view: "ring-2 ring-sky-500 ring-offset-1 dark:ring-sky-400"
          }}
          captionLayout="dropdown-years"
          fromYear={2023}
          toYear={2035}
          disabled={{ after: new Date() }}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-3 dark:border-slate-700">
        <Button type="button" size="sm" variant="outline" onClick={() => setDraftRange(undefined)}>
          Clear
        </Button>
        {resolvedDisplay === "popover" ? (
          <Button type="button" size="sm" variant="outline" onClick={closePicker}>
            Cancel
          </Button>
        ) : null}
        {!autoApply ? (
          <Button type="button" size="sm" disabled={!canApply} onClick={applyDraftRange}>
            Apply range
          </Button>
        ) : null}
      </div>
    </>
  );

  const controls = (
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
      {!isToday ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="border-slate-300 dark:border-slate-600"
          onClick={() => {
            onRangeChange(today, today);
            onActiveDateChange(today);
            closePicker();
          }}
        >
          Today
        </Button>
      ) : null}
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="border-slate-300 dark:border-slate-600"
        aria-expanded={open}
        aria-haspopup={resolvedDisplay === "popover" ? "dialog" : undefined}
        onClick={() => {
          if (resolvedDisplay === "inline") toggleInline();
          else if (open) closePicker();
          else openPicker();
        }}
      >
        <CalendarDays className="mr-1.5 h-4 w-4" aria-hidden />
        {resolvedDisplay === "inline" ? (open ? "Hide calendar" : "Show calendar") : "Calendar"}
        <ChevronDown
          className={cn("ml-1.5 h-4 w-4 transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </Button>
    </div>
  );

  return (
    <div
      ref={rootRef}
      className={cn(
        resolvedDisplay === "inline" ? "w-full" : "relative",
        variant === "bar" && "flex w-full justify-end"
      )}
    >
      {variant === "bar" ? (
        <div className="flex w-full flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white/80 p-3 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/50 sm:ml-auto sm:w-auto sm:min-w-[min(100%,22rem)]">
          <div className="min-w-0 flex-1 text-left sm:flex-initial">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              View date range
            </p>
            <p className="mt-0.5 truncate text-sm font-medium text-slate-900 dark:text-slate-100">
              {formatAttendanceRangeLabel(from, to)}
            </p>
          </div>
          {controls}
        </div>
      ) : headerStart ? (
        <div className="flex w-full flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">{headerStart}</div>
          {controls}
        </div>
      ) : (
        <div
          className={cn(
            "flex w-full flex-wrap items-center justify-between gap-2",
            resolvedDisplay === "inline" &&
              !headerStart &&
              "rounded-xl border border-slate-200/90 bg-slate-50/50 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/40"
          )}
        >
          {resolvedDisplay === "inline" ? (
            <p className="min-w-0 flex-1 text-sm font-medium text-slate-900 dark:text-slate-100">
              {formatAttendanceRangeLabel(from, to)}
            </p>
          ) : null}
          {controls}
        </div>
      )}

      {open && resolvedDisplay === "inline" ? (
        <div className="attendance-range-popover mt-3 w-full overflow-x-auto rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-950">
          {pickerBody}
        </div>
      ) : null}

      {open && resolvedDisplay === "popover"
        ? (() => {
            const popover = (
              <div
                id="attendance-range-popover"
                role="dialog"
                aria-label="Choose attendance date range"
                style={
                  popoverPos
                    ? {
                        position: "fixed",
                        top: popoverPos.top,
                        left: popoverPos.left,
                        width: Math.min(popoverWidth, window.innerWidth - VIEWPORT_PAD * 2),
                        maxWidth: `calc(100vw - ${VIEWPORT_PAD * 2}px)`,
                        maxHeight: popoverPos.maxHeight,
                        zIndex: 100
                      }
                    : { visibility: "hidden" as const }
                }
                className="attendance-range-popover attendance-range-popover--floating overflow-x-auto overflow-y-auto rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-950"
              >
                {pickerBody}
              </div>
            );

            return typeof document !== "undefined" ? createPortal(popover, document.body) : popover;
          })()
        : null}
    </div>
  );
}


