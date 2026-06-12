"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DayPicker, type DateRange } from "react-day-picker";
import { format } from "date-fns";
import "react-day-picker/dist/style.css";
import { areSearchQueriesEqual } from "@/lib/url-search-params";

type DepartmentOption = { id: number; name: string };

type AttendanceReportFiltersProps = {
  mode: "daily" | "range";
  date: string;
  from: string;
  to: string;
  preset: string;
  search: string;
  status: "all" | "present" | "working" | "absent";
  agentState: "all" | "running" | "installed" | "stale" | "not_installed";
  alertsOnly: boolean;
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

const SEARCH_DEBOUNCE_MS = 300;

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
  const pathname = usePathname();
  const searchParams = useSearchParams();
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
  const [debouncedSearch, setDebouncedSearch] = useState(props.search);
  const [status, setStatus] = useState(props.status);
  const [agentState, setAgentState] = useState(props.agentState);
  const [alertsOnly, setAlertsOnly] = useState(props.alertsOnly);
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

  useEffect(() => {
    setMode(props.mode);
    setSearch(props.search);
    setDebouncedSearch(props.search);
    setStatus(props.status);
    setAgentState(props.agentState);
    setAlertsOnly(props.alertsOnly);
    setDepartmentId(props.departmentId);
    setPreset(
      props.preset === "last_7_days" ||
        props.preset === "last_14_days" ||
        props.preset === "last_month"
        ? props.preset
        : ""
    );
    setPeriod(
      props.mode === "daily"
        ? "daily"
        : props.preset === "last_7_days" ||
            props.preset === "last_14_days" ||
            props.preset === "last_month"
          ? props.preset
          : "custom"
    );
    setRange({ from: toDate(props.from), to: toDate(props.to) });
  }, [
    props.mode,
    props.search,
    props.status,
    props.agentState,
    props.alertsOnly,
    props.departmentId,
    props.preset,
    props.from,
    props.to
  ]);

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [search]);

  const queryString = useMemo(() => {
    const q = new URLSearchParams();
    q.set("date", props.date);
    q.set("mode", mode);
    q.set("from", fromIso);
    q.set("to", toIsoValue);
    if (preset) q.set("preset", preset);
    if (debouncedSearch) q.set("search", debouncedSearch);
    if (status !== "all" && mode === "daily") q.set("status", status);
    if (agentState !== "all") q.set("agentState", agentState);
    if (alertsOnly) q.set("alerts", "1");
    if (departmentId) q.set("departmentId", departmentId);
    return q.toString();
  }, [
    props.date,
    mode,
    fromIso,
    toIsoValue,
    preset,
    debouncedSearch,
    status,
    agentState,
    alertsOnly,
    departmentId
  ]);

  const pushFilters = useCallback(() => {
    if (areSearchQueriesEqual(queryString, searchParams.toString())) return;
    router.replace(`${pathname}?${queryString}`);
  }, [pathname, queryString, router, searchParams]);

  useEffect(() => {
    pushFilters();
  }, [pushFilters]);

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
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-base font-medium uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
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
          <label className="block text-base font-medium uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
            Search (name or email)
          </label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="e.g. hadi or @gmail.com"
            className="form-input mt-1 min-h-[2.75rem] py-2 leading-5"
            aria-label="Search employees by name or email"
          />
        </div>
        <div>
          <label className="block text-base font-medium uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
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
            <label className="block text-base font-medium uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
              Agent
            </label>
            <select
              value={agentState}
              onChange={(e) =>
                setAgentState(e.target.value as AttendanceReportFiltersProps["agentState"])
              }
              className="form-input mt-1 min-h-[2.75rem] min-w-[11rem] py-2 leading-5"
            >
              <option value="all">All agent states</option>
              <option value="running">Running</option>
              <option value="installed">Installed</option>
              <option value="stale">No recent activity</option>
              <option value="not_installed">Not installed</option>
            </select>
          </div>
        ) : null}
        {props.isAdmin ? (
          <div className="flex min-h-[2.75rem] items-center">
            <label className="inline-flex cursor-pointer items-center gap-2 text-base text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={alertsOnly}
                onChange={(e) => setAlertsOnly(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
              />
              Alerts only
            </label>
          </div>
        ) : null}
        {props.isAdmin ? (
          <div>
            <label className="block text-base font-medium uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
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
    </div>
  );
}
