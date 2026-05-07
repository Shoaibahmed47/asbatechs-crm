"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DayPicker, type DateRange } from "react-day-picker";
import { format } from "date-fns";
import "react-day-picker/dist/style.css";

import { CopyReportLinkButton } from "./CopyReportLinkButton";

type DepartmentOption = { id: number; name: string };

type AttendanceReportFiltersProps = {
  mode: "daily" | "range";
  date: string;
  from: string;
  to: string;
  preset: string;
  search: string;
  status: "all" | "present" | "working" | "absent";
  departmentId: string;
  departments: DepartmentOption[];
  isAdmin: boolean;
};

const RANGE_OPTIONS = [
  { value: "custom", label: "Calendar" },
  { value: "daily", label: "Daily" },
  { value: "last_7_days", label: "Last 7 days" },
  { value: "last_14_days", label: "Last 2 week" },
  { value: "last_month", label: "Last month" }
] as const;

function toDate(iso: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return undefined;
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function toIso(d?: Date): string {
  if (!d) return "";
  return format(d, "yyyy-MM-dd");
}

function shiftDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toIso(d);
}

function rangeFromPreset(preset: string, today: string): { from: string; to: string } {
  const now = toDate(today) ?? new Date();
  if (preset === "last_7_days") return { from: shiftDays(today, -6), to: today };
  if (preset === "last_14_days") return { from: shiftDays(today, -13), to: today };
  if (preset === "last_month") {
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const to = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: toIso(from), to: toIso(to) };
  }
  return { from: today, to: today };
}

export function AttendanceReportFilters(props: AttendanceReportFiltersProps) {
  const router = useRouter();
  const today = props.date;
  const initialPeriod =
    props.mode === "daily"
      ? "daily"
      : props.preset === "last_7_days" ||
          props.preset === "last_14_days" ||
          props.preset === "last_month"
        ? props.preset
        : "custom";
  const [mode, setMode] = useState<"daily" | "range">(props.mode);
  const [search, setSearch] = useState(props.search);
  const [status, setStatus] = useState(props.status);
  const [departmentId, setDepartmentId] = useState(props.departmentId);
  const [preset, setPreset] = useState(
    props.preset === "last_7_days" ||
      props.preset === "last_14_days" ||
      props.preset === "last_month"
      ? props.preset
      : ""
  );
  const [period, setPeriod] = useState(initialPeriod);
  const [range, setRange] = useState<DateRange | undefined>({
    from: toDate(props.from),
    to: toDate(props.to)
  });

  const fromIso = toIso(range?.from) || props.from;
  const toIsoValue = toIso(range?.to) || fromIso || props.to;

  const exportHref = useMemo(() => {
    const q = new URLSearchParams();
    q.set("date", props.date);
    q.set("mode", mode);
    q.set("from", fromIso);
    q.set("to", toIsoValue);
    if (preset) q.set("preset", preset);
    if (search.trim()) q.set("search", search.trim());
    if (status !== "all") q.set("status", status);
    if (departmentId) q.set("departmentId", departmentId);
    q.set("format", "csv");
    return `/api/reports/attendance-daily?${q.toString()}`;
  }, [props.date, mode, fromIso, toIsoValue, preset, search, status, departmentId]);

  function applyFilters() {
    const q = new URLSearchParams();
    q.set("date", props.date);
    q.set("mode", mode);
    q.set("from", fromIso);
    q.set("to", toIsoValue);
    if (preset) q.set("preset", preset);
    if (search.trim()) q.set("search", search.trim());
    if (status !== "all" && mode === "daily") q.set("status", status);
    if (departmentId) q.set("departmentId", departmentId);
    router.push(`/attendance/report?${q.toString()}`);
  }

  function applyPreset(value: string) {
    setPreset(value);
    const computed = rangeFromPreset(value, today);
    setRange({ from: toDate(computed.from), to: toDate(computed.to) });
  }

  function onChangePeriod(value: string) {
    setPeriod(value);
    if (value === "daily") {
      setMode("daily");
      setPreset("");
      setRange({ from: toDate(props.date), to: toDate(props.date) });
      return;
    }
    setMode("range");
    if (value === "custom") {
      setPreset("");
      return;
    }
    applyPreset(value);
  }

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white/80 p-4 dark:border-slate-700/70 dark:bg-slate-900/50">
      {/* Prevent clipped text in selects/inputs across browsers */}
      {/* by overriding fixed-height + inherited padding combination. */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400">
            Date range
          </label>
          <select
            value={period}
            onChange={(e) => onChangePeriod(e.target.value)}
            className="form-input mt-1 min-h-[2.75rem] min-w-[8.5rem] py-2 leading-5"
          >
            {RANGE_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[14rem] flex-1">
          <label className="block text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
            Search (name or email)
          </label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="e.g. hadi or @gmail.com"
            className="form-input mt-1 min-h-[2.75rem] py-2 leading-5"
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
            Status
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as AttendanceReportFiltersProps["status"])}
            className="form-input mt-1 min-h-[2.75rem] min-w-[10rem] py-2 leading-5"
            disabled={mode === "range"}
          >
            <option value="all">All</option>
            <option value="present">Present</option>
            <option value="working">Working</option>
            <option value="absent">Absent</option>
          </select>
        </div>
        {props.isAdmin ? (
          <div>
            <label className="block text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
              Department
            </label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="form-input mt-1 min-h-[2.75rem] min-w-[12rem] py-2 leading-5"
            >
              <option value="">All departments</option>
              {props.departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      {mode === "range" ? (
        <div className="grid gap-3">
          <div className="overflow-auto rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-950/40">
            <DayPicker
              mode="range"
              numberOfMonths={2}
              selected={range}
              onSelect={(next) => {
                setPreset("");
                setPeriod("custom");
                setRange(next);
              }}
              captionLayout="dropdown-years"
              fromYear={2023}
              toYear={2035}
            />
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={applyFilters}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-sky-300 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-sky-600"
        >
          Apply
        </button>
        <a
          href={exportHref}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-center text-sm font-medium text-slate-700 shadow-sm transition hover:border-sky-300 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-sky-600"
        >
          Export CSV
        </a>
        <CopyReportLinkButton
          queryParams={{
            mode,
            date: props.date,
            from: fromIso,
            to: toIsoValue,
            preset,
            search,
            status: mode === "daily" ? status : "all",
            departmentId
          }}
        />
      </div>
    </div>
  );
}
