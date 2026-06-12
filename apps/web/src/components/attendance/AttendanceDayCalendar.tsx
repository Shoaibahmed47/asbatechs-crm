"use client";

import { useEffect, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import { format } from "date-fns";
import { CalendarDays, ChevronDown } from "lucide-react";
import "react-day-picker/dist/style.css";

import { Button } from "@/components/ui/button";
import { ATTENDANCE_TIME_ZONE, getLocalDateString } from "@/lib/attendance-date";
import { cn } from "@/lib/utils";

type Props = {
  selectedDate: string;
  onSelectDate: (iso: string) => void;
};

function toDate(iso: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return undefined;
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function toIso(d?: Date): string {
  if (!d) return "";
  return format(d, "yyyy-MM-dd");
}

export function AttendanceDayCalendar({ selectedDate, onSelectDate }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = toDate(selectedDate);
  const isToday = selectedDate === getLocalDateString();
  /** Bumped when the popover opens so DayPicker remounts at the selected date's month. */
  const [calendarKey, setCalendarKey] = useState(0);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const selectedLabel = selected
    ? selected.toLocaleDateString(undefined, {
        timeZone: ATTENDANCE_TIME_ZONE,
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric"
      })
    : "Pick a date";

  return (
    <div ref={rootRef} className="relative flex justify-end">
      <div className="flex w-full flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white/80 p-3 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/50 sm:ml-auto sm:w-auto sm:min-w-[min(100%,22rem)]">
        <div className="min-w-0 flex-1 text-left sm:flex-initial">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            View date
          </p>
          <p className="mt-0.5 truncate text-sm font-medium text-slate-900 dark:text-slate-100">
            {selectedLabel}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!isToday ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-slate-300 dark:border-slate-600"
              onClick={() => onSelectDate(getLocalDateString())}
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
            aria-haspopup="dialog"
            onClick={() => {
              setOpen((prev) => {
                const next = !prev;
                if (next) setCalendarKey((k) => k + 1);
                return next;
              });
            }}
          >
            <CalendarDays className="mr-1.5 h-4 w-4" aria-hidden />
            Calendar
            <ChevronDown
              className={cn("ml-1.5 h-4 w-4 transition-transform", open && "rotate-180")}
              aria-hidden
            />
          </Button>
        </div>
      </div>

      {open ? (
        <div
          role="dialog"
          aria-label="Choose attendance date"
          className="absolute right-0 top-full z-30 mt-2 w-[min(100vw-2rem,20rem)] overflow-hidden rounded-xl border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-950"
        >
          <DayPicker
            key={calendarKey}
            mode="single"
            numberOfMonths={1}
            defaultMonth={selected ?? new Date()}
            selected={selected}
            onSelect={(day) => {
              const iso = toIso(day);
              if (!iso) return;
              onSelectDate(iso);
              setOpen(false);
            }}
            captionLayout="dropdown-years"
            fromYear={2023}
            toYear={2035}
            disabled={{ after: new Date() }}
          />
        </div>
      ) : null}
    </div>
  );
}
