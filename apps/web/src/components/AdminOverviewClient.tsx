"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Clock, Filter, RefreshCw } from "lucide-react";
import { AdminExportControls } from "@/components/AdminExportControls";
import { Button } from "@/components/ui/button";
import { ApiFetchError, apiFetch } from "@/lib/api-fetch";
import { ATTENDANCE_TIME_ZONE } from "@/lib/attendance-date";
import type { AdminSnapshot } from "@/lib/admin-snapshot-types";
import {
  formatOfficeTimeLabel,
  officeShiftEndsNextDay,
  type AttendanceOfficeHours
} from "@/lib/attendance-office-hours";

type Role = "admin" | "manager";
type SortDirection = "asc" | "desc";
type PanelKey = "departments" | "users" | "leads" | "invites" | "activity";
type AgentHealthState = "all" | "running" | "installed" | "stale" | "not_installed";

type AgentHealthRow = {
  userId: number;
  userName: string;
  userEmail: string;
  departmentId: number | null;
  departmentName: string | null;
  openShift: boolean;
  attendanceStatus: "active" | "break" | "idle" | "offline";
  attendanceReason: string;
  sleepMinutes: number;
  lastAgentActivityAt: string | null;
  lastAgentActivitySource: string | null;
  lastAgentAgeSeconds: number | null;
  lastSeenAt: string | null;
  lastSeenSource: string | null;
  lastSeenAgeSeconds: number | null;
  state: Exclude<AgentHealthState, "all">;
  needsAttention: boolean;
};

type SortState = {
  key: string;
  direction: SortDirection;
};

const PAGE_SIZE = 8;

function parseDate(value: string | null | undefined): number {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function matchesSearch(haystack: Array<string | null | undefined>, search: string): boolean {
  if (!search) return true;
  const lower = search.toLowerCase();
  return haystack.some((value) => (value ?? "").toLowerCase().includes(lower));
}

function inDateRange(value: string | null, from: string, to: string): boolean {
  if (!from && !to) return true;
  const ts = parseDate(value);
  if (!ts) return false;
  const fromTs = from ? new Date(`${from}T00:00:00`).getTime() : Number.NEGATIVE_INFINITY;
  const toTs = to ? new Date(`${to}T23:59:59`).getTime() : Number.POSITIVE_INFINITY;
  return ts >= fromTs && ts <= toTs;
}

function sortRows<T extends Record<string, unknown>>(rows: T[], sort: SortState): T[] {
  const output = [...rows];
  output.sort((a, b) => {
    const av = a[sort.key];
    const bv = b[sort.key];

    const normalize = (value: unknown): string | number => {
      if (typeof value === "number") return value;
      if (typeof value === "string") return value.toLowerCase();
      if (value instanceof Date) return value.getTime();
      return value == null ? "" : String(value).toLowerCase();
    };

    const va = normalize(av);
    const vb = normalize(bv);
    if (va < vb) return sort.direction === "asc" ? -1 : 1;
    if (va > vb) return sort.direction === "asc" ? 1 : -1;
    return 0;
  });
  return output;
}

function paginate<T>(rows: T[], page: number): T[] {
  const start = (page - 1) * PAGE_SIZE;
  return rows.slice(start, start + PAGE_SIZE);
}

function trend(current: number, previous: number): { label: string; tone: string } {
  if (previous <= 0) {
    return {
      label: current > 0 ? "+100%" : "0%",
      tone: current > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400"
    };
  }
  const diff = ((current - previous) / previous) * 100;
  const rounded = Math.round(diff);
  if (rounded > 0) {
    return { label: `+${rounded}%`, tone: "text-emerald-600 dark:text-emerald-400" };
  }
  if (rounded < 0) {
    return { label: `${rounded}%`, tone: "text-rose-600 dark:text-rose-400" };
  }
  return { label: "0%", tone: "text-slate-500 dark:text-slate-400" };
}

function formatAge(seconds: number | null): string {
  if (seconds == null) return "Never";
  if (seconds < 60) return `${seconds}s ago`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function agentLabel(state: Exclude<AgentHealthState, "all">): string {
  if (state === "running") return "Running";
  if (state === "installed") return "Installed";
  if (state === "stale") return "No recent activity";
  return "Not installed";
}

function agentPillTone(state: Exclude<AgentHealthState, "all">): string {
  if (state === "running") return "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300";
  if (state === "installed") return "bg-sky-500/15 text-sky-800 dark:text-sky-300";
  if (state === "stale") return "bg-amber-500/15 text-amber-900 dark:text-amber-300";
  return "bg-slate-200/80 text-slate-700 dark:bg-slate-800 dark:text-slate-400";
}

function SortableHead({
  label,
  active,
  direction,
  onClick
}: {
  label: string;
  active: boolean;
  direction: SortDirection;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 font-medium text-slate-600 transition hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
      onClick={onClick}
    >
      {label}
      {active ? direction === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" /> : null}
    </button>
  );
}

function EmptyRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-6 text-center text-base text-slate-500 dark:text-slate-400">
        {message}
      </td>
    </tr>
  );
}

export function AdminOverviewClient({
  snapshot,
  role
}: {
  snapshot: AdminSnapshot;
  role: Role;
}) {
  const isAdmin = role === "admin";
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [activePanel, setActivePanel] = useState<PanelKey | null>(null);

  const [sortBy, setSortBy] = useState<Record<PanelKey, SortState>>({
    departments: { key: "name", direction: "asc" },
    users: { key: "createdAt", direction: "desc" },
    leads: { key: "createdAt", direction: "desc" },
    invites: { key: "createdAt", direction: "desc" },
    activity: { key: "createdAt", direction: "desc" }
  });

  const [pages, setPages] = useState<Record<PanelKey, number>>({
    departments: 1,
    users: 1,
    leads: 1,
    invites: 1,
    activity: 1
  });

  const [resendEmail, setResendEmail] = useState("");
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [officeHours, setOfficeHours] = useState<AttendanceOfficeHours | null>(null);
  const [officeCheckInTime, setOfficeCheckInTime] = useState("19:00");
  const [officeEndTime, setOfficeEndTime] = useState("16:00");
  const [officeLateGraceMinutes, setOfficeLateGraceMinutes] = useState(15);
  const [officeHoursLoading, setOfficeHoursLoading] = useState(false);
  const [officeHoursSaving, setOfficeHoursSaving] = useState(false);
  const [officeHoursMessage, setOfficeHoursMessage] = useState<string | null>(null);
  const [officeHoursError, setOfficeHoursError] = useState<string | null>(null);
  const [agentRows, setAgentRows] = useState<AgentHealthRow[]>([]);
  const [agentCounts, setAgentCounts] = useState<
    Record<Exclude<AgentHealthState, "all">, number>
  >({
    running: 0,
    installed: 0,
    stale: 0,
    not_installed: 0
  });
  const [agentStateFilter, setAgentStateFilter] = useState<AgentHealthState>("all");
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentError, setAgentError] = useState<string | null>(null);

  const usersForFilter = useMemo(
    () => [...snapshot.users].sort((a, b) => a.name.localeCompare(b.name)),
    [snapshot.users]
  );

  useEffect(() => {
    if (!isAdmin) return;

    let cancelled = false;
    const load = async () => {
      setAgentLoading(true);
      setAgentError(null);
      try {
        const query = new URLSearchParams();
        if (search.trim()) query.set("search", search.trim());
        if (departmentFilter) query.set("departmentId", departmentFilter);
        if (agentStateFilter !== "all") query.set("state", agentStateFilter);
        const data = await apiFetch<{
          rows: AgentHealthRow[];
          counts: Partial<Record<Exclude<AgentHealthState, "all">, number>>;
        }>(`/api/admin/agent-health?${query.toString()}`);
        if (cancelled) return;
        setAgentRows(data.rows ?? []);
        setAgentCounts({
          running: data.counts?.running ?? 0,
          installed: data.counts?.installed ?? 0,
          stale: data.counts?.stale ?? 0,
          not_installed: data.counts?.not_installed ?? 0
        });
      } catch (error) {
        if (cancelled) return;
        setAgentError(
          error instanceof ApiFetchError
            ? error.message
            : "Could not load desktop agent health."
        );
      } finally {
        if (!cancelled) setAgentLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [isAdmin, search, departmentFilter, agentStateFilter]);

  useEffect(() => {
    if (!isAdmin) return;

    let cancelled = false;
    const loadOfficeHours = async () => {
      setOfficeHoursLoading(true);
      setOfficeHoursError(null);
      try {
        const data = await apiFetch<{ settings: AttendanceOfficeHours }>(
          "/api/admin/attendance/office-hours"
        );
        if (cancelled) return;
        setOfficeHours(data.settings);
        setOfficeCheckInTime(data.settings.expectedCheckInTime);
        setOfficeEndTime(data.settings.shiftEndTime);
        setOfficeLateGraceMinutes(data.settings.lateGraceMinutes ?? 15);
      } catch (error) {
        if (cancelled) return;
        setOfficeHoursError(
          error instanceof ApiFetchError
            ? error.message
            : "Could not load office timing."
        );
      } finally {
        if (!cancelled) setOfficeHoursLoading(false);
      }
    };

    void loadOfficeHours();
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  const statusOptions = useMemo(() => {
    const leadStatuses = snapshot.leads.map((l) => l.status);
    const inviteStatuses = snapshot.users.map((u) => u.inviteStatus);
    return Array.from(new Set([...leadStatuses, ...inviteStatuses])).sort();
  }, [snapshot.leads, snapshot.users]);

  const filtered = useMemo(() => {
    const departments = snapshot.departments.filter((d) => {
      if (!matchesSearch([d.name, d.description], search)) return false;
      return inDateRange(d.createdAt, dateFrom, dateTo);
    });

    const users = snapshot.users.filter((u) => {
      if (departmentFilter && String(u.departmentId ?? "") !== departmentFilter) return false;
      if (userFilter && String(u.id) !== userFilter) return false;
      if (statusFilter && u.inviteStatus !== statusFilter) return false;
      if (!matchesSearch([u.name, u.email, u.role, u.departmentName], search)) return false;
      return inDateRange(u.createdAt, dateFrom, dateTo);
    });

    const leads = snapshot.leads.filter((l) => {
      if (departmentFilter && String(l.departmentId ?? "") !== departmentFilter) return false;
      if (userFilter && String(l.assignedUserId ?? "") !== userFilter) return false;
      if (statusFilter && l.status !== statusFilter) return false;
      if (!matchesSearch([l.clientName, l.email, l.phone, l.status, l.departmentName], search)) return false;
      return inDateRange(l.createdAt, dateFrom, dateTo);
    });

    const invites = snapshot.pendingInvites.filter((i) => {
      if (departmentFilter && String(i.departmentId ?? "") !== departmentFilter) return false;
      if (!matchesSearch([i.email, i.departmentName], search)) return false;
      return inDateRange(i.createdAt, dateFrom, dateTo);
    });

    const activity = snapshot.recentActivity.filter((a) => {
      if (userFilter && String(a.userId) !== userFilter) return false;
      if (statusFilter) {
        const failed = /(fail|error|deny|invalid)/i.test(a.action);
        const status = failed ? "failed" : "success";
        if (status !== statusFilter) return false;
      }
      if (!matchesSearch([a.actorName, a.actorEmail, a.action, a.entityType, String(a.entityId)], search))
        return false;
      return inDateRange(a.createdAt, dateFrom, dateTo);
    });

    return { departments, users, leads, invites, activity };
  }, [
    snapshot,
    search,
    dateFrom,
    dateTo,
    departmentFilter,
    userFilter,
    statusFilter
  ]);

  const trendStats = useMemo(() => {
    const now = new Date(snapshot.generatedAt);
    const from = dateFrom ? new Date(`${dateFrom}T00:00:00`) : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const to = dateTo ? new Date(`${dateTo}T23:59:59`) : now;
    const windowMs = Math.max(24 * 60 * 60 * 1000, to.getTime() - from.getTime());
    const prevFrom = new Date(from.getTime() - windowMs);
    const prevTo = new Date(to.getTime() - windowMs);

    const inWindow = (value: string | null, start: Date, end: Date) => {
      const ts = parseDate(value);
      return ts >= start.getTime() && ts <= end.getTime();
    };

    const build = (curr: number, prev: number) => trend(curr, prev);

    const currentDepartments = snapshot.departments.filter((d) => inWindow(d.createdAt, from, to)).length;
    const previousDepartments = snapshot.departments.filter((d) => inWindow(d.createdAt, prevFrom, prevTo)).length;
    const currentUsers = snapshot.users.filter((u) => inWindow(u.createdAt, from, to)).length;
    const previousUsers = snapshot.users.filter((u) => inWindow(u.createdAt, prevFrom, prevTo)).length;
    const currentHot = snapshot.leads.filter((l) => l.type === "hot" && inWindow(l.createdAt, from, to)).length;
    const previousHot = snapshot.leads.filter((l) => l.type === "hot" && inWindow(l.createdAt, prevFrom, prevTo)).length;
    const currentSale = snapshot.leads.filter((l) => l.type === "sale" && inWindow(l.createdAt, from, to)).length;
    const previousSale = snapshot.leads.filter((l) => l.type === "sale" && inWindow(l.createdAt, prevFrom, prevTo)).length;
    const currentInvites = snapshot.pendingInvites.filter((i) => inWindow(i.createdAt, from, to)).length;
    const previousInvites = snapshot.pendingInvites.filter((i) => inWindow(i.createdAt, prevFrom, prevTo)).length;

    return {
      departments: build(currentDepartments, previousDepartments),
      users: build(currentUsers, previousUsers),
      hotLeads: build(currentHot, previousHot),
      saleLeads: build(currentSale, previousSale),
      pendingInvites: build(currentInvites, previousInvites)
    };
  }, [snapshot, dateFrom, dateTo]);

  const sorted = {
    departments: sortRows(filtered.departments, sortBy.departments),
    users: sortRows(filtered.users, sortBy.users),
    leads: sortRows(filtered.leads, sortBy.leads),
    invites: sortRows(filtered.invites, sortBy.invites),
    activity: sortRows(filtered.activity, sortBy.activity)
  };

  const pageCounts: Record<PanelKey, number> = {
    departments: Math.max(1, Math.ceil(sorted.departments.length / PAGE_SIZE)),
    users: Math.max(1, Math.ceil(sorted.users.length / PAGE_SIZE)),
    leads: Math.max(1, Math.ceil(sorted.leads.length / PAGE_SIZE)),
    invites: Math.max(1, Math.ceil(sorted.invites.length / PAGE_SIZE)),
    activity: Math.max(1, Math.ceil(sorted.activity.length / PAGE_SIZE))
  };

  const paged = {
    departments: paginate(sorted.departments, Math.min(pages.departments, pageCounts.departments)),
    users: paginate(sorted.users, Math.min(pages.users, pageCounts.users)),
    leads: paginate(sorted.leads, Math.min(pages.leads, pageCounts.leads)),
    invites: paginate(sorted.invites, Math.min(pages.invites, pageCounts.invites)),
    activity: paginate(sorted.activity, Math.min(pages.activity, pageCounts.activity))
  };

  const setSort = (panel: PanelKey, key: string) => {
    setSortBy((prev) => {
      const current = prev[panel];
      if (current.key === key) {
        return { ...prev, [panel]: { key, direction: current.direction === "asc" ? "desc" : "asc" } };
      }
      return { ...prev, [panel]: { key, direction: "asc" } };
    });
  };

  const setPage = (panel: PanelKey, nextPage: number) => {
    setPages((prev) => ({
      ...prev,
      [panel]: Math.min(Math.max(1, nextPage), pageCounts[panel])
    }));
  };

  const clearFilters = () => {
    setSearch("");
    setDateFrom("");
    setDateTo("");
    setDepartmentFilter("");
    setUserFilter("");
    setStatusFilter("");
  };

  const panelLabels: Record<PanelKey, string> = {
    departments: "Departments",
    users: "Users",
    leads: "Leads",
    invites: "Pending invitations",
    activity: "Audit logs"
  };

  const showAllSections = () => {
    setActivePanel(null);
    requestAnimationFrame(() => {
      document.getElementById("admin-overview-tables")?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });
  };

  const focusPanel = (panel: PanelKey) => {
    setActivePanel((current) => (current === panel ? null : panel));
  };

  const handleSaveOfficeHours = async () => {
    setOfficeHoursSaving(true);
    setOfficeHoursMessage(null);
    setOfficeHoursError(null);
    try {
      const data = await apiFetch.put<{ settings: AttendanceOfficeHours }>(
        "/api/admin/attendance/office-hours",
        {
          expectedCheckInTime: officeCheckInTime,
          shiftEndTime: officeEndTime,
          lateGraceMinutes: officeLateGraceMinutes
        }
      );
      setOfficeHours(data.settings);
      setOfficeCheckInTime(data.settings.expectedCheckInTime);
      setOfficeEndTime(data.settings.shiftEndTime);
      setOfficeLateGraceMinutes(data.settings.lateGraceMinutes ?? 15);
      setOfficeHoursMessage("Office timing saved.");
    } catch (error) {
      setOfficeHoursError(
        error instanceof ApiFetchError ? error.message : "Failed to save office timing."
      );
    } finally {
      setOfficeHoursSaving(false);
    }
  };

  const handleResendInvite = async () => {
    if (!resendEmail.trim()) return;
    setActionBusy(true);
    setActionMessage(null);
    setActionError(null);
    try {
      await apiFetch.post("/api/users/resend-invite", { email: resendEmail.trim().toLowerCase() });
      setActionMessage("Invitation sent successfully.");
      setResendEmail("");
    } catch (error) {
      setActionError(error instanceof ApiFetchError ? error.message : "Failed to resend invitation.");
    } finally {
      setActionBusy(false);
    }
  };

  const sectionVisible = (panel: PanelKey) => !activePanel || activePanel === panel;

  const cardClass =
    "data-card px-4 py-3 text-left transition hover:border-sky-300 hover:bg-sky-50/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 dark:hover:border-sky-700 dark:hover:bg-sky-950/20";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Admin control</h1>
          <p className="mt-1 max-w-2xl text-base text-slate-600 dark:text-slate-400">
            Global filtered control view for departments, people, leads, invites, and activity.
          </p>
          <p className="mt-1 text-base text-slate-500 dark:text-slate-400">
            Snapshot time:{" "}
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {new Date(snapshot.generatedAt).toLocaleString()}
            </span>
          </p>
        </div>
        {isAdmin ? <AdminExportControls snapshot={snapshot} /> : null}
      </div>

      <section className="data-card p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
          <Filter className="h-3.5 w-3.5" />
          Global filters
        </div>
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search all tables"
            className="form-input"
          />
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="form-input" />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="form-input" />
          <select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)} className="form-input">
            <option value="">All departments</option>
            {snapshot.departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <select value={userFilter} onChange={(e) => setUserFilter(e.target.value)} className="form-input">
            <option value="">All users</option>
            {usersForFilter.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="form-input">
            <option value="">All statuses</option>
            <option value="success">Audit: success</option>
            <option value="failed">Audit: failed</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
            Reset filters
          </Button>
          <Button
            type="button"
            variant={activePanel ? "default" : "outline"}
            size="sm"
            onClick={showAllSections}
            disabled={!activePanel}
            title={
              activePanel
                ? "Show every table section again"
                : "All sections are already visible"
            }
          >
            Show all sections
          </Button>
        </div>
        {activePanel ? (
          <p className="mt-2 text-sm text-sky-800 dark:text-sky-300">
            Focused on <span className="font-semibold">{panelLabels[activePanel]}</span> only.
            Other tables are hidden until you click <span className="font-semibold">Show all sections</span>{" "}
            or the same summary card again.
          </p>
        ) : null}
      </section>

      {isAdmin ? (
        <section className="data-card p-4">
          <div className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            Quick actions
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/users" className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm">
              Invite user
            </Link>
            <Link href="/settings/departments" className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm">
              Create department
            </Link>
            <div className="flex flex-1 flex-wrap items-center gap-2">
              <input
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                placeholder="email@example.com"
                className="form-input w-full min-w-[14rem] flex-1"
              />
              <Button type="button" size="sm" disabled={actionBusy} onClick={handleResendInvite}>
                {actionBusy ? <RefreshCw className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                Resend invite
              </Button>
            </div>
          </div>
          {actionMessage ? <p className="mt-2 text-sm text-emerald-600 dark:text-emerald-400">{actionMessage}</p> : null}
          {actionError ? <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{actionError}</p> : null}
        </section>
      ) : null}

      {isAdmin ? (
        <section className="data-card p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            <Clock className="h-3.5 w-3.5" />
            Office timing (attendance)
          </div>
          <p className="mb-3 text-base text-slate-600 dark:text-slate-400">
            Set expected check-in, shift end, and how many minutes late are ignored
            before late arrival is recorded.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-base font-medium text-slate-600 dark:text-slate-400">
                Expected check-in
              </span>
              <input
                type="time"
                value={officeCheckInTime}
                onChange={(e) => setOfficeCheckInTime(e.target.value)}
                disabled={officeHoursLoading || officeHoursSaving}
                className="form-input"
              />
              <span className="text-base text-slate-500 dark:text-slate-400">
                {formatOfficeTimeLabel(officeCheckInTime)}
              </span>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-base font-medium text-slate-600 dark:text-slate-400">
                Shift end
              </span>
              <input
                type="time"
                value={officeEndTime}
                onChange={(e) => setOfficeEndTime(e.target.value)}
                disabled={officeHoursLoading || officeHoursSaving}
                className="form-input"
              />
              <span className="text-base text-slate-500 dark:text-slate-400">
                {formatOfficeTimeLabel(officeEndTime)}
                {officeShiftEndsNextDay(officeCheckInTime, officeEndTime)
                  ? " · next day"
                  : ""}
              </span>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-base font-medium text-slate-600 dark:text-slate-400">
                Late grace (minutes)
              </span>
              <input
                type="number"
                min={0}
                max={120}
                value={officeLateGraceMinutes}
                onChange={(e) =>
                  setOfficeLateGraceMinutes(Math.min(120, Math.max(0, Number(e.target.value))))
                }
                disabled={officeHoursLoading || officeHoursSaving}
                className="form-input"
              />
              <span className="text-base text-slate-500 dark:text-slate-400">
                Up to {officeLateGraceMinutes} min late is ignored; after that, full late
                minutes count.
              </span>
            </label>
            <div className="flex items-end">
              <Button
                type="button"
                size="sm"
                disabled={officeHoursLoading || officeHoursSaving}
                onClick={() => void handleSaveOfficeHours()}
              >
                {officeHoursSaving ? (
                  <RefreshCw className="mr-1 h-3.5 w-3.5 animate-spin" />
                ) : null}
                Save timing
              </Button>
            </div>
          </div>
          {officeHours?.updatedAt ? (
            <p className="mt-2 text-base text-slate-500 dark:text-slate-400">
              Last updated: {new Date(officeHours.updatedAt).toLocaleString()}
            </p>
          ) : null}
          {officeHoursMessage ? (
            <p className="mt-2 text-sm text-emerald-600 dark:text-emerald-400">
              {officeHoursMessage}
            </p>
          ) : null}
          {officeHoursError ? (
            <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{officeHoursError}</p>
          ) : null}
        </section>
      ) : null}

      {isAdmin ? (
        <section className="data-card overflow-hidden p-0">
          <div className="border-b border-slate-200/90 bg-slate-100/90 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/85">
            <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Desktop agent
            </div>
            <h2 className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
              Agent health monitor
            </h2>
            <p className="mt-1 text-base text-slate-600 dark:text-slate-400">
              Running vs no recent activity on employee devices.
            </p>
            <p className="mt-1 text-sm text-rose-700 dark:text-rose-300">
              Alert: shift open + no employee signal for 10+ minutes.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {(["all", "running", "installed", "stale", "not_installed"] as const).map(
                (state) => {
                  const isActive = agentStateFilter === state;
                  const count =
                    state === "all" ? agentRows.length : agentCounts[state] ?? 0;
                  return (
                    <button
                      key={state}
                      type="button"
                      onClick={() => setAgentStateFilter(state)}
                      className={`rounded-full border px-3 py-1 text-sm font-semibold transition ${
                        isActive
                          ? "border-sky-400 bg-sky-50 text-sky-800 dark:border-sky-600 dark:bg-sky-950/40 dark:text-sky-300"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                      }`}
                    >
                      {state === "all" ? "All" : agentLabel(state)} ({count})
                    </button>
                  );
                }
              )}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setAgentStateFilter("all")}
              >
                Reset
              </Button>
            </div>
            {agentError ? (
              <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{agentError}</p>
            ) : null}
          </div>
          <div className="max-h-[min(20rem,42vh)] overflow-auto">
            <table className="w-full min-w-[56rem] text-sm">
              <thead className="sticky top-0 z-[1] bg-slate-50 text-left text-sm font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-900/95 dark:text-slate-400">
                <tr>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Department</th>
                  <th className="px-3 py-2">Agent</th>
                  <th className="px-3 py-2">Last seen</th>
                  <th className="px-3 py-2">Shift</th>
                  <th className="px-3 py-2">Attendance</th>
                  <th className="px-3 py-2">Sleep</th>
                  <th className="px-3 py-2">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-800 dark:divide-slate-800 dark:text-slate-200">
                {agentLoading ? (
                  <EmptyRow colSpan={9} message="Loading agent health..." />
                ) : agentRows.length === 0 ? (
                  <EmptyRow colSpan={9} message="No matching agent records." />
                ) : (
                  agentRows.map((row) => (
                    <tr key={row.userId} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="px-3 py-2 font-medium">{row.userName}</td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                        {row.userEmail}
                      </td>
                      <td className="px-3 py-2">{row.departmentName ?? "-"}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-sm font-semibold uppercase tracking-wide ${agentPillTone(
                            row.state
                          )}`}
                        >
                          {agentLabel(row.state)}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {formatAge(row.lastSeenAgeSeconds)}
                        {row.needsAttention ? (
                          <span className="ml-2 rounded-full bg-rose-500/15 px-2 py-0.5 text-sm font-semibold uppercase text-rose-700 dark:text-rose-300">
                            Alert
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">{row.openShift ? "Open" : "Closed"}</td>
                      <td className="px-3 py-2 capitalize">{row.attendanceStatus}</td>
                      <td className="px-3 py-2 tabular-nums">
                        {Math.max(0, row.sleepMinutes ?? 0)}m
                      </td>
                      <td className="max-w-[20rem] px-3 py-2 text-slate-700 dark:text-slate-300">
                        {row.attendanceReason}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <div id="admin-overview-tables" className="scroll-mt-6 space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Departments", value: filtered.departments.length, panel: "departments" as PanelKey, trend: trendStats.departments },
          { label: "Users", value: filtered.users.length, panel: "users" as PanelKey, trend: trendStats.users },
          { label: "Hot leads", value: filtered.leads.filter((l) => l.type === "hot").length, panel: "leads" as PanelKey, trend: trendStats.hotLeads },
          { label: "Sale leads", value: filtered.leads.filter((l) => l.type === "sale").length, panel: "leads" as PanelKey, trend: trendStats.saleLeads },
          { label: "Pending invites", value: filtered.invites.length, panel: "invites" as PanelKey, trend: trendStats.pendingInvites }
        ].map((item) => {
          const isFocused = activePanel === item.panel;
          return (
          <button
            key={item.label}
            type="button"
            className={`${cardClass} ${isFocused ? "border-sky-400 bg-sky-50/60 ring-2 ring-sky-300/80 dark:border-sky-600 dark:bg-sky-950/30 dark:ring-sky-700/80" : ""}`}
            onClick={() => focusPanel(item.panel)}
            aria-pressed={isFocused}
            title={isFocused ? "Click again to show all sections" : `Show only ${panelLabels[item.panel]}`}
          >
            <div className="text-sm font-medium uppercase text-slate-500 dark:text-slate-400">{item.label}</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">{item.value}</div>
            <div className={`mt-1 text-sm font-semibold ${item.trend.tone}`}>{item.trend.label} vs previous period</div>
          </button>
        );
        })}
      </div>

      {sectionVisible("departments") ? (
        <section className="data-card overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-slate-200/90 bg-slate-100/90 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900/85">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Departments</h2>
            <span className="text-sm text-slate-500">{sorted.departments.length} total</span>
          </div>
          <div className="max-h-[min(24rem,50vh)] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-[1] bg-slate-50 text-left text-base text-slate-600 dark:bg-slate-900/95 dark:text-slate-400">
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="px-3 py-2 font-medium">
                    <SortableHead label="ID" active={sortBy.departments.key === "id"} direction={sortBy.departments.direction} onClick={() => setSort("departments", "id")} />
                  </th>
                  <th className="px-3 py-2 font-medium">
                    <SortableHead label="Name" active={sortBy.departments.key === "name"} direction={sortBy.departments.direction} onClick={() => setSort("departments", "name")} />
                  </th>
                  <th className="px-3 py-2 font-medium">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-800 dark:divide-slate-800 dark:text-slate-200">
                {paged.departments.length === 0 ? (
                  <EmptyRow colSpan={3} message="No departments match current filters." />
                ) : (
                  paged.departments.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="px-3 py-2">{d.id}</td>
                      <td className="px-3 py-2 font-medium">{d.name}</td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{d.description ?? "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-slate-200/90 px-3 py-2 dark:border-slate-700">
            <Button type="button" variant="outline" size="sm" onClick={() => setPage("departments", pages.departments - 1)}>Prev</Button>
            <span className="text-sm text-slate-500">Page {Math.min(pages.departments, pageCounts.departments)} / {pageCounts.departments}</span>
            <Button type="button" variant="outline" size="sm" onClick={() => setPage("departments", pages.departments + 1)}>Next</Button>
          </div>
        </section>
      ) : null}

      {sectionVisible("users") ? (
        <section className="data-card overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-slate-200/90 bg-slate-100/90 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900/85">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Users</h2>
            <span className="text-sm text-slate-500">{sorted.users.length} total</span>
          </div>
          <div className="max-h-[min(24rem,50vh)] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-[1] bg-slate-50 text-left text-base text-slate-600 dark:bg-slate-900/95 dark:text-slate-400">
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="px-3 py-2 font-medium">
                    <SortableHead label="Name" active={sortBy.users.key === "name"} direction={sortBy.users.direction} onClick={() => setSort("users", "name")} />
                  </th>
                  <th className="px-3 py-2 font-medium">Email</th>
                  <th className="px-3 py-2 font-medium">
                    <SortableHead label="Role" active={sortBy.users.key === "role"} direction={sortBy.users.direction} onClick={() => setSort("users", "role")} />
                  </th>
                  <th className="px-3 py-2 font-medium">Department</th>
                  <th className="px-3 py-2 font-medium">Invite</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-800 dark:divide-slate-800 dark:text-slate-200">
                {paged.users.length === 0 ? (
                  <EmptyRow colSpan={5} message="No users match current filters." />
                ) : (
                  paged.users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="px-3 py-2 font-medium">{u.name}</td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{isAdmin ? u.email : "Hidden for manager"}</td>
                      <td className="px-3 py-2 capitalize">{u.role}</td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{u.departmentName ?? "—"}</td>
                      <td className="px-3 py-2">{u.inviteStatus}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-slate-200/90 px-3 py-2 dark:border-slate-700">
            <Button type="button" variant="outline" size="sm" onClick={() => setPage("users", pages.users - 1)}>Prev</Button>
            <span className="text-sm text-slate-500">Page {Math.min(pages.users, pageCounts.users)} / {pageCounts.users}</span>
            <Button type="button" variant="outline" size="sm" onClick={() => setPage("users", pages.users + 1)}>Next</Button>
          </div>
        </section>
      ) : null}

      {sectionVisible("invites") ? (
        <section className="data-card overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-slate-200/90 bg-slate-100/90 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900/85">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Pending invitations</h2>
            <span className="text-sm text-slate-500">{sorted.invites.length} total</span>
          </div>
          <div className="max-h-[min(24rem,50vh)] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-[1] bg-slate-50 text-left text-base text-slate-600 dark:bg-slate-900/95 dark:text-slate-400">
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="px-3 py-2 font-medium">Email</th>
                  <th className="px-3 py-2 font-medium">Department</th>
                  <th className="px-3 py-2 font-medium">
                    <SortableHead label="Created" active={sortBy.invites.key === "createdAt"} direction={sortBy.invites.direction} onClick={() => setSort("invites", "createdAt")} />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-800 dark:divide-slate-800 dark:text-slate-200">
                {paged.invites.length === 0 ? (
                  <EmptyRow colSpan={3} message="No pending invitations for current filters." />
                ) : (
                  paged.invites.map((i) => (
                    <tr key={i.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="px-3 py-2">{isAdmin ? i.email : "Hidden for manager"}</td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{i.departmentName ?? "—"}</td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{i.createdAt ? new Date(i.createdAt).toLocaleString() : "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-slate-200/90 px-3 py-2 dark:border-slate-700">
            <Button type="button" variant="outline" size="sm" onClick={() => setPage("invites", pages.invites - 1)}>Prev</Button>
            <span className="text-sm text-slate-500">Page {Math.min(pages.invites, pageCounts.invites)} / {pageCounts.invites}</span>
            <Button type="button" variant="outline" size="sm" onClick={() => setPage("invites", pages.invites + 1)}>Next</Button>
          </div>
        </section>
      ) : null}

      {sectionVisible("leads") ? (
        <section className="data-card overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-slate-200/90 bg-slate-100/90 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900/85">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">All leads (hot & sale)</h2>
            <span className="text-sm text-slate-500">{sorted.leads.length} total</span>
          </div>
          <div className="max-h-[min(24rem,50vh)] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-[1] bg-slate-50 text-left text-base text-slate-600 dark:bg-slate-900/95 dark:text-slate-400">
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="px-3 py-2 font-medium">
                    <SortableHead label="ID" active={sortBy.leads.key === "id"} direction={sortBy.leads.direction} onClick={() => setSort("leads", "id")} />
                  </th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Client</th>
                  <th className="px-3 py-2 font-medium">Contact</th>
                  <th className="px-3 py-2 font-medium">Dept</th>
                  <th className="px-3 py-2 font-medium">Assigned</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Sale</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-800 dark:divide-slate-800 dark:text-slate-200">
                {paged.leads.length === 0 ? (
                  <EmptyRow colSpan={8} message="No leads match current filters." />
                ) : (
                  paged.leads.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="px-3 py-2">{l.id}</td>
                      <td className="px-3 py-2 capitalize">{l.type}</td>
                      <td className="px-3 py-2 font-medium">{l.clientName}</td>
                      <td className="px-3 py-2">{[l.phone, l.email].filter(Boolean).join(" · ") || "—"}</td>
                      <td className="px-3 py-2">{l.departmentName ?? "—"}</td>
                      <td className="px-3 py-2">{l.assignedUserName ?? "—"}</td>
                      <td className="px-3 py-2">{l.status}</td>
                      <td className="px-3 py-2">{l.type === "sale" && l.saleAmount ? l.saleAmount : "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-slate-200/90 px-3 py-2 dark:border-slate-700">
            <Button type="button" variant="outline" size="sm" onClick={() => setPage("leads", pages.leads - 1)}>Prev</Button>
            <span className="text-sm text-slate-500">Page {Math.min(pages.leads, pageCounts.leads)} / {pageCounts.leads}</span>
            <Button type="button" variant="outline" size="sm" onClick={() => setPage("leads", pages.leads + 1)}>Next</Button>
          </div>
        </section>
      ) : null}

      {sectionVisible("activity") ? (
        <section className="data-card overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-slate-200/90 bg-slate-100/90 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900/85">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Enhanced audit logs</h2>
            <span className="text-sm text-slate-500">{sorted.activity.length} total</span>
          </div>
          <div className="max-h-[min(24rem,50vh)] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-[1] bg-slate-50 text-left text-base text-slate-600 dark:bg-slate-900/95 dark:text-slate-400">
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="px-3 py-2 font-medium">
                    <SortableHead label="When" active={sortBy.activity.key === "createdAt"} direction={sortBy.activity.direction} onClick={() => setSort("activity", "createdAt")} />
                  </th>
                  <th className="px-3 py-2 font-medium">Actor</th>
                  <th className="px-3 py-2 font-medium">Action type</th>
                  <th className="px-3 py-2 font-medium">Result</th>
                  <th className="px-3 py-2 font-medium">Entity</th>
                  <th className="px-3 py-2 font-medium">IP</th>
                  <th className="px-3 py-2 font-medium">Device</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-800 dark:divide-slate-800 dark:text-slate-200">
                {paged.activity.length === 0 ? (
                  <EmptyRow colSpan={7} message="No audit events match current filters." />
                ) : (
                  paged.activity.map((a) => {
                    const failed = /(fail|error|deny|invalid)/i.test(a.action);
                    const actionType = a.action.split("_")[0] || a.action;
                    return (
                      <tr key={a.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                        <td className="whitespace-nowrap px-3 py-2">{a.createdAt ? new Date(a.createdAt).toLocaleString() : "—"}</td>
                        <td className="px-3 py-2">{a.actorName}</td>
                        <td className="px-3 py-2">{actionType}</td>
                        <td className={`px-3 py-2 font-medium ${failed ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                          {failed ? "failed" : "success"}
                        </td>
                        <td className="px-3 py-2">{`${a.entityType} #${a.entityId}`}</td>
                        <td className="px-3 py-2 text-slate-500">N/A</td>
                        <td className="px-3 py-2 text-slate-500">N/A</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-slate-200/90 px-3 py-2 dark:border-slate-700">
            <Button type="button" variant="outline" size="sm" onClick={() => setPage("activity", pages.activity - 1)}>Prev</Button>
            <span className="text-sm text-slate-500">Page {Math.min(pages.activity, pageCounts.activity)} / {pageCounts.activity}</span>
            <Button type="button" variant="outline" size="sm" onClick={() => setPage("activity", pages.activity + 1)}>Next</Button>
          </div>
        </section>
      ) : null}
      </div>
    </div>
  );
}
