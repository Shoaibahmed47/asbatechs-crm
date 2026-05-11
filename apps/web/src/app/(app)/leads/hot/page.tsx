"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Flame } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";
import { TablePagination } from "@/components/TablePagination";
import { LeadEntryForm } from "@/components/leads/lead-entry-form";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiFetchError, apiFetch } from "@/lib/api-fetch";
import { leadPermissionUserMessage } from "@/lib/lead-api-errors";
import { LEAD_STAGE_OPTIONS, type LeadStage } from "@/lib/lead-workflow";
import { cn } from "@/lib/utils";

type HotLead = {
  id: number;
  type: "hot";
  clientName: string;
  phone: string | null;
  email: string | null;
  source: string | null;
  departmentId: number | null;
  assignedUserId: number | null;
  status: string;
  notes: string | null;
  nextFollowUpAt: string | null;
  followUpTimezone: string | null;
  createdAt: string | null;
};

type Department = { id: number; name: string };
type UserRow = { id: number; name: string; email: string };

type MeUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  departmentId: number | null;
  departmentName: string | null;
};

type LeadFieldErrors = Partial<Record<string, string>>;

const STATUS_OPTIONS = LEAD_STAGE_OPTIONS;
const OTHER_TIMEZONE_VALUE = "__other_timezone__";
const FOLLOW_UP_TIMEZONE_OPTIONS = [
  { value: "America/New_York", label: "Eastern Time (America/New_York)" },
  { value: "America/Chicago", label: "Central Time (America/Chicago)" },
  { value: "America/Denver", label: "Mountain Time (America/Denver)" },
  { value: "America/Los_Angeles", label: "Pacific Time (America/Los_Angeles)" },
  { value: "America/Anchorage", label: "Alaska Time (America/Anchorage)" },
  { value: "Pacific/Honolulu", label: "Hawaii-Aleutian Time (Pacific/Honolulu)" }
] as const;

function toLocalDateTimeInputValue(iso: string): string {
  const date = new Date(iso);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function formatFollowUpDateTime(iso: string, timeZone: string | null): string {
  const date = new Date(iso);
  if (!timeZone) {
    return date.toLocaleString();
  }
  try {
    return `${new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone
    }).format(date)} (${timeZone})`;
  } catch {
    return `${date.toLocaleString()} (${timeZone})`;
  }
}

function getFollowUpBadge(lead: HotLead) {
  if (!lead.nextFollowUpAt) return null;
  const now = new Date();
  const follow = new Date(lead.nextFollowUpAt);
  const diffMs = follow.getTime() - now.getTime();
  const oneHourMs = 60 * 60 * 1000;

  if (diffMs < 0) {
    return (
      <span className="ml-2 inline-flex rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700 dark:bg-red-900/40 dark:text-red-200">
        Overdue
      </span>
    );
  }
  if (diffMs <= oneHourMs) {
    return (
      <span className="ml-2 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
        Due soon
      </span>
    );
  }
  return null;
}

function apiErrorDetail(error: ApiFetchError): string | null {
  const details = error.details;
  if (!details || typeof details !== "object") return null;
  const record = details as Record<string, unknown>;
  if (typeof record.error === "string" && record.error.trim()) {
    return record.error;
  }
  if (typeof record.detail === "string" && record.detail.trim()) {
    return record.detail;
  }
  return null;
}

function apiLeadFieldErrors(error: ApiFetchError): LeadFieldErrors {
  const details = error.details;
  if (!details || typeof details !== "object") return {};
  const record = details as Record<string, unknown>;
  const flattened = record.details;
  if (!flattened || typeof flattened !== "object") return {};
  const fieldErrorsRaw = (flattened as Record<string, unknown>).fieldErrors;
  if (!fieldErrorsRaw || typeof fieldErrorsRaw !== "object") return {};

  const output: LeadFieldErrors = {};
  for (const [key, value] of Object.entries(fieldErrorsRaw as Record<string, unknown>)) {
    if (Array.isArray(value) && value.length > 0) {
      const first = value.find((entry) => typeof entry === "string");
      if (typeof first === "string" && first.trim()) {
        output[key] = first;
      }
    }
  }
  return output;
}

export default function HotLeadsPage() {
  const [leads, setLeads] = useState<HotLead[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [me, setMe] = useState<MeUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [convertingLeadId, setConvertingLeadId] = useState<number | null>(null);
  const [deletingLeadId, setDeletingLeadId] = useState<number | null>(null);
  const [deleteTargetLead, setDeleteTargetLead] = useState<HotLead | null>(null);
  const [editingLeadId, setEditingLeadId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formFieldErrors, setFormFieldErrors] = useState<LeadFieldErrors>({});

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterAssign, setFilterAssign] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [followUpFrom, setFollowUpFrom] = useState("");
  const [followUpTo, setFollowUpTo] = useState("");

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [sort, setSort] = useState("next_follow_up_date");
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [clientName, setClientName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [source, setSource] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [assignedUserId, setAssignedUserId] = useState("");
  const [status, setStatus] = useState<LeadStage>("New");
  const [notes, setNotes] = useState("");
  const [nextFollowUpAtLocal, setNextFollowUpAtLocal] = useState("");
  const [followUpTimezone, setFollowUpTimezone] = useState("");
  const [customFollowUpTimezone, setCustomFollowUpTimezone] = useState("");

  const clearFieldError = useCallback((field: string) => {
    setFormFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  useEffect(() => {
    const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (browserTz) {
      if (FOLLOW_UP_TIMEZONE_OPTIONS.some((option) => option.value === browserTz)) {
        setFollowUpTimezone(browserTz);
      } else {
        setFollowUpTimezone(OTHER_TIMEZONE_VALUE);
        setCustomFollowUpTimezone(browserTz);
      }
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [
    debouncedSearch,
    filterDept,
    filterAssign,
    filterStatus,
    createdFrom,
    createdTo,
    followUpFrom,
    followUpTo,
    limit
  ]);

  useEffect(() => {
    async function loadMeta() {
      try {
        const [d, u, session] = await Promise.all([
          apiFetch<{ departments?: Department[] }>("/api/departments"),
          apiFetch<{ users?: UserRow[] }>("/api/users"),
          apiFetch<{ user: MeUser | null }>("/api/auth/me")
        ]);
        setDepartments(d.departments ?? []);
        setUsers(u.users ?? []);
        setMe(session.user);
      } catch {
        setDepartments([]);
        setUsers([]);
        setMe(null);
      }
    }
    void loadMeta();
  }, []);

  const formDepartments = useMemo(() => {
    if (!me) return departments;
    if (me.role === "admin") return departments;
    if (me.role === "employee") return departments;
    if (me.departmentId == null) return [];
    if (me.role === "manager") {
      return departments.filter((d) => d.id === me.departmentId);
    }
    return departments;
  }, [me, departments]);

  const formUsers = useMemo(() => {
    return users;
  }, [users]);

  const departmentLocked =
    !!me &&
    me.role !== "admin" &&
    me.role !== "employee" &&
    me.departmentId != null &&
    me.role === "manager";

  const formHint = useMemo(() => {
    if (!me) return undefined;
    if (me.role === "employee") {
      return "You can choose any department and assign this lead to any user.";
    }
    if (me.role === "manager" && me.departmentId == null) {
      return "Your manager profile has no department. Contact an administrator.";
    }
    if (me.role === "manager" && me.departmentId != null) {
      return `Leads are scoped to ${me.departmentName ?? "your department"}. You can assign to teammates in that department.`;
    }
    return undefined;
  }, [me]);
  const submitDisabledReason = useMemo(() => {
    if (me?.role === "manager" && me.departmentId == null) {
      return "Save is disabled until an administrator assigns your department.";
    }
    return undefined;
  }, [me]);

  const applyMeFormDefaults = useCallback(() => {
    if (!me) return;
    if (editingLeadId) return;
    if (me.role === "admin" || me.role === "employee") return;
    if (me.departmentId != null && me.role === "manager") {
      setDepartmentId(String(me.departmentId));
    }
  }, [me, editingLeadId]);

  useEffect(() => {
    applyMeFormDefaults();
  }, [applyMeFormDefaults]);

  const loadLeads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      params.set("sort", sort);
      params.set("order", order);
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (filterDept) params.set("departmentId", filterDept);
      if (filterAssign) params.set("assignedUserId", filterAssign);
      if (filterStatus) params.set("status", filterStatus);
      if (createdFrom) params.set("createdFrom", createdFrom);
      if (createdTo) params.set("createdTo", createdTo);
      if (followUpFrom) params.set("followUpFrom", followUpFrom);
      if (followUpTo) params.set("followUpTo", followUpTo);
      const data = await apiFetch<{
        leads?: HotLead[];
        total?: number;
        page?: number;
        limit?: number;
        totalPages?: number;
      }>(`/api/leads/hot?${params.toString()}`);
      setLeads(data.leads ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 0);
    } catch (error) {
      if (error instanceof ApiFetchError) {
        if (error.status !== 401) setError(error.message);
      } else {
        setError("Something went wrong while loading leads.");
      }
    } finally {
      setLoading(false);
    }
  }, [
    page,
    limit,
    sort,
    order,
    debouncedSearch,
    filterDept,
    filterAssign,
    filterStatus,
    createdFrom,
    createdTo,
    followUpFrom,
    followUpTo
  ]);

  useEffect(() => {
    void loadLeads();
  }, [loadLeads]);

  const handleSort = useCallback(
    (column: string) => {
      if (column === sort) {
        setOrder((o) => (o === "asc" ? "desc" : "asc"));
      } else {
        setSort(column);
        setOrder("desc");
      }
      setPage(1);
    },
    [sort]
  );

  const sortHead = (column: string, label: string, className?: string) => {
    const active = sort === column;
    return (
      <th className={cn("pb-2 text-left font-medium", className)}>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1 uppercase",
            active ? "text-sky-600 dark:text-sky-400" : ""
          )}
          onClick={() => handleSort(column)}
        >
          {label}
          {active ? (order === "asc" ? "↑" : "↓") : null}
        </button>
      </th>
    );
  };

  const deptName = (id: number | null) =>
    id == null
      ? "—"
      : departments.find((d) => d.id === id)?.name ?? `#${id}`;

  const userName = (id: number | null) =>
    id == null
      ? "—"
      : users.find((u) => u.id === id)?.name ?? `#${id}`;

  function resetForm() {
    setClientName("");
    setPhone("");
    setEmail("");
    setSource("");
    setDepartmentId("");
    setAssignedUserId("");
    setStatus("New");
    setNotes("");
    setNextFollowUpAtLocal("");
    setCustomFollowUpTimezone("");
    setFormFieldErrors({});
    setEditingLeadId(null);
    queueMicrotask(() => {
      if (!me) return;
      if (me.role === "admin" || me.role === "employee") return;
      if (me.departmentId != null && me.role === "manager") {
        setDepartmentId(String(me.departmentId));
      }
    });
  }

  function startEdit(lead: HotLead) {
    setEditingLeadId(lead.id);
    setClientName(lead.clientName ?? "");
    setPhone(lead.phone ?? "");
    setEmail(lead.email ?? "");
    setSource(lead.source ?? "");
    setDepartmentId(lead.departmentId != null ? String(lead.departmentId) : "");
    setAssignedUserId(lead.assignedUserId != null ? String(lead.assignedUserId) : "");
    setStatus((lead.status as LeadStage) ?? "New");
    setNotes(lead.notes ?? "");
    setNextFollowUpAtLocal(
      lead.nextFollowUpAt ? toLocalDateTimeInputValue(lead.nextFollowUpAt) : ""
    );
    const resolvedTimezone =
      lead.followUpTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    if (FOLLOW_UP_TIMEZONE_OPTIONS.some((option) => option.value === resolvedTimezone)) {
      setFollowUpTimezone(resolvedTimezone);
      setCustomFollowUpTimezone("");
    } else {
      setFollowUpTimezone(OTHER_TIMEZONE_VALUE);
      setCustomFollowUpTimezone(resolvedTimezone);
    }
    document
      .getElementById("hot-lead-form")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const isActiveStatus = status !== "Won" && status !== "Lost";
    if (isActiveStatus && !nextFollowUpAtLocal.trim()) {
      toast.error("Add a follow-up date and time.", {
        description: "Active hot leads must have a scheduled follow-up."
      });
      return;
    }
    setSaving(true);
    setError(null);
    setFormFieldErrors({});
    try {
      const body: Record<string, unknown> = {
        clientName: clientName.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        source: source.trim() || undefined,
        status,
        notes: notes.trim() || undefined
      };
      const effectiveTimezone =
        followUpTimezone === OTHER_TIMEZONE_VALUE
          ? customFollowUpTimezone.trim()
          : followUpTimezone;
      if (nextFollowUpAtLocal) {
        body.nextFollowUpAtLocal = nextFollowUpAtLocal;
        body.followUpTimezone = effectiveTimezone || undefined;
      } else {
        body.nextFollowUpAtLocal = undefined;
      }
      if (assignedUserId) body.assignedUserId = Number(assignedUserId);
      else body.assignedUserId = null;

      if (editingLeadId) {
        await apiFetch.patch(`/api/leads/hot/${editingLeadId}`, body);
        toast.success("Lead updated", {
          description: `${clientName.trim()} was updated successfully.`
        });
      } else {
        await apiFetch.post("/api/leads/hot", body);
        toast.success("Hot lead saved", {
          description: `${clientName.trim()} was added to your pipeline.`
        });
      }
      resetForm();
      await loadLeads();
    } catch (error) {
      if (error instanceof ApiFetchError) {
        const fieldErrors = apiLeadFieldErrors(error);
        if (Object.keys(fieldErrors).length > 0) {
          setFormFieldErrors(fieldErrors);
        }
        const rootCause = apiErrorDetail(error);
        const detail = leadPermissionUserMessage(error.status, rootCause ?? error.message);
        toast.error(detail, {
          description:
            error.status >= 500
              ? "Server error while saving hot lead."
              : "Hot lead was not saved.",
          duration: 10000
        });
      } else {
        toast.error("Check your connection and try again.", {
          description: "Hot lead was not saved.",
          duration: 9000
        });
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleConvertToSale(leadId: number) {
    setConvertingLeadId(leadId);
    try {
      await apiFetch.post(`/api/leads/hot/${leadId}/convert`);
      toast.success("Lead converted", {
        description: "Hot lead moved to Sales leads with stage Won."
      });
      await loadLeads();
    } catch (error) {
      const detail =
        error instanceof ApiFetchError
          ? leadPermissionUserMessage(error.status, error.message)
          : "Check your connection and try again.";
      toast.error(detail, {
        description: "Lead was not converted.",
        duration: 9000
      });
    } finally {
      setConvertingLeadId(null);
    }
  }

  async function handleDeleteLead() {
    if (!deleteTargetLead) return;
    setDeletingLeadId(deleteTargetLead.id);
    try {
      await apiFetch.post(`/api/leads/hot/${deleteTargetLead.id}/delete`);
      toast.success("Lead deleted", {
        description: `${deleteTargetLead.clientName} was removed from hot leads.`
      });
      if (editingLeadId === deleteTargetLead.id) {
        resetForm();
      }
      await loadLeads();
    } catch (error) {
      const detail =
        error instanceof ApiFetchError
          ? leadPermissionUserMessage(error.status, error.message)
          : "Check your connection and try again.";
      toast.error(detail, {
        description: "Lead was not deleted.",
        duration: 9000
      });
    } finally {
      setDeletingLeadId(null);
      setDeleteTargetLead(null);
    }
  }

  const filterControlClass =
    "form-input h-9 py-2 text-sm md:h-9 md:py-2";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Hot leads
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Potential clients (type: <span className="font-medium">hot</span>).
          Rows live in the unified <code className="text-xs">leads</code> table
          with <code className="text-xs">type = hot</code>.
        </p>
      </div>

      {error && (
        <div
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/35 dark:text-red-300"
          role="alert"
        >
          {error}
        </div>
      )}

      {editingLeadId ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          <span>Editing lead #{editingLeadId}. Update fields and save.</span>
        </div>
      ) : null}

      <LeadEntryForm
        mode="hot"
        formId="hot-lead-form"
        title={editingLeadId ? "Edit hot lead" : "Add hot lead (manual entry)"}
        description="Required: client name. Optional: phone, email, source, follow-up datetime/timezone, assignee, notes."
        submitLabel={editingLeadId ? "Update lead" : "Save lead"}
        saving={saving}
        departments={formDepartments}
        users={formUsers}
        formHint={formHint}
        submitDisabledReason={submitDisabledReason}
        departmentLocked={departmentLocked}
        statusOptions={STATUS_OPTIONS}
        clientName={clientName}
        onClientNameChange={(value) => {
          setClientName(value);
          clearFieldError("clientName");
        }}
        phone={phone}
        onPhoneChange={(value) => {
          setPhone(value);
          clearFieldError("phone");
        }}
        email={email}
        onEmailChange={(value) => {
          setEmail(value);
          clearFieldError("email");
        }}
        source={source}
        onSourceChange={(value) => {
          setSource(value);
          clearFieldError("source");
        }}
        departmentId={departmentId}
        onDepartmentIdChange={(value) => {
          setDepartmentId(value);
          clearFieldError("departmentId");
        }}
        showDepartment={false}
        assignedUserId={assignedUserId}
        onAssignedUserIdChange={(value) => {
          setAssignedUserId(value);
          clearFieldError("assignedUserId");
        }}
        status={status}
        onStatusChange={(value) => {
          setStatus(value);
          clearFieldError("status");
        }}
        notes={notes}
        onNotesChange={(value) => {
          setNotes(value);
          clearFieldError("notes");
        }}
        nextFollowUpAtLocal={nextFollowUpAtLocal}
        onNextFollowUpAtLocalChange={(value) => {
          setNextFollowUpAtLocal(value);
          clearFieldError("nextFollowUpAtLocal");
        }}
        followUpTimezone={followUpTimezone}
        onFollowUpTimezoneChange={(value) => {
          setFollowUpTimezone(value);
          clearFieldError("followUpTimezone");
        }}
        timezoneOptions={[
          ...FOLLOW_UP_TIMEZONE_OPTIONS,
          { value: OTHER_TIMEZONE_VALUE, label: "Other (IANA timezone)" }
        ]}
        showCustomTimezoneInput={followUpTimezone === OTHER_TIMEZONE_VALUE}
        customTimezone={customFollowUpTimezone}
        onCustomTimezoneChange={(value) => {
          setCustomFollowUpTimezone(value);
          clearFieldError("customTimezone");
        }}
        onCancel={editingLeadId ? resetForm : undefined}
        cancelLabel="Cancel edit"
        fieldErrors={formFieldErrors}
        onSubmit={handleCreate}
      />

      <div className="data-card p-4">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            All hot leads
          </h2>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="block text-[10px] font-medium uppercase text-slate-500 dark:text-slate-400">
                Search
              </label>
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Name, phone, email…"
                className={`${filterControlClass} mt-1 w-44`}
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium uppercase text-slate-500 dark:text-slate-400">
                Department
              </label>
              <select
                value={filterDept}
                onChange={(e) => setFilterDept(e.target.value)}
                className={`${filterControlClass} mt-1 min-w-[8rem]`}
              >
                <option value="">All</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-medium uppercase text-slate-500 dark:text-slate-400">
                Assigned
              </label>
              <select
                value={filterAssign}
                onChange={(e) => setFilterAssign(e.target.value)}
                className={`${filterControlClass} mt-1 min-w-[8rem]`}
              >
                <option value="">All</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-medium uppercase text-slate-500 dark:text-slate-400">
                Stage
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className={`${filterControlClass} mt-1 min-w-[8rem]`}
              >
                <option value="">All</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-medium uppercase text-slate-500 dark:text-slate-400">
                Created from
              </label>
              <input
                type="date"
                value={createdFrom}
                onChange={(e) => setCreatedFrom(e.target.value)}
                className={`${filterControlClass} mt-1 w-[11rem]`}
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium uppercase text-slate-500 dark:text-slate-400">
                Created to
              </label>
              <input
                type="date"
                value={createdTo}
                onChange={(e) => setCreatedTo(e.target.value)}
                className={`${filterControlClass} mt-1 w-[11rem]`}
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium uppercase text-slate-500 dark:text-slate-400">
                Follow-up from
              </label>
              <input
                type="date"
                value={followUpFrom}
                onChange={(e) => setFollowUpFrom(e.target.value)}
                className={`${filterControlClass} mt-1 w-[11rem]`}
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium uppercase text-slate-500 dark:text-slate-400">
                Follow-up to
              </label>
              <input
                type="date"
                value={followUpTo}
                onChange={(e) => setFollowUpTo(e.target.value)}
                className={`${filterControlClass} mt-1 w-[11rem]`}
              />
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={loading}
              onClick={() => void loadLeads()}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </div>

        <div className="max-h-[min(65vh,560px)] overflow-auto rounded-lg border border-slate-200/40 dark:border-slate-700/40">
          <table className="w-full min-w-[720px] table-auto text-sm">
            <thead>
              <tr className="sticky top-0 z-[1] border-b border-slate-200/80 bg-slate-50/95 text-xs uppercase text-slate-500 shadow-[0_1px_0_0_rgba(15,23,42,0.06)] backdrop-blur-sm dark:border-slate-700/80 dark:bg-slate-900/95 dark:text-slate-400 dark:shadow-[0_1px_0_0_rgba(0,0,0,0.3)]">
                {sortHead("client_name", "Client")}
                <th className="pb-2 text-left font-medium">Phone</th>
                <th className="pb-2 text-left font-medium">Email</th>
                {sortHead("source", "Source")}
                {sortHead("department_id", "Department")}
                {sortHead("assigned_user_id", "Assigned")}
                {sortHead("status", "Status")}
                {sortHead("next_follow_up_date", "Follow-up")}
                <th className="pb-2 text-left font-medium">Notes</th>
                {sortHead("created_at", "Created")}
                <th className="pb-2 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && leads.length === 0 ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-100/80 dark:border-slate-800/80">
                    <td className="py-3 pr-2">
                      <Skeleton className="h-4 w-36" />
                    </td>
                    <td className="py-3 pr-2">
                      <Skeleton className="h-4 w-24" />
                    </td>
                    <td className="py-3 pr-2">
                      <Skeleton className="h-4 w-28" />
                    </td>
                    <td className="py-3 pr-2">
                      <Skeleton className="h-4 w-20" />
                    </td>
                    <td className="py-3 pr-2">
                      <Skeleton className="h-4 w-20" />
                    </td>
                    <td className="py-3 pr-2">
                      <Skeleton className="h-4 w-24" />
                    </td>
                    <td className="py-3 pr-2">
                      <Skeleton className="h-4 w-16" />
                    </td>
                    <td className="py-3 pr-2">
                      <Skeleton className="h-4 w-28" />
                    </td>
                    <td className="py-3 pr-2">
                      <Skeleton className="h-4 w-36" />
                    </td>
                    <td className="py-3">
                      <Skeleton className="h-4 w-24" />
                    </td>
                    <td className="py-3 pl-2">
                      <Skeleton className="ml-auto h-7 w-24" />
                    </td>
                  </tr>
                ))
              ) : !loading && leads.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-0">
                    <EmptyState
                      icon={Flame}
                      title="No hot leads to show"
                      description={
                        error
                          ? "Adjust filters or refresh. You can still add a lead using the form above."
                          : "Start your pipeline by adding your first hot lead, or widen search filters if some records are hidden."
                      }
                    >
                      <Button
                        type="button"
                        size="sm"
                        onClick={() =>
                          document
                            .getElementById("hot-lead-form")
                            ?.scrollIntoView({ behavior: "smooth", block: "start" })
                        }
                      >
                        Add a hot lead
                      </Button>
                    </EmptyState>
                  </td>
                </tr>
              ) : (
                leads.map((lead) => (
                  <tr
                    key={lead.id}
                    className="border-b border-slate-100/90 last:border-b-0 dark:border-slate-800/90"
                  >
                    <td className="py-2.5 text-sm font-medium text-slate-900 dark:text-slate-100">
                      <div className="flex items-center gap-2">
                        <span>{lead.clientName}</span>
                        {getFollowUpBadge(lead)}
                      </div>
                    </td>
                    <td className="py-2.5 text-xs text-slate-600 dark:text-slate-300">
                      {lead.phone || "—"}
                    </td>
                    <td className="py-2.5 text-xs text-slate-600 dark:text-slate-300">
                      {lead.email || "—"}
                    </td>
                    <td className="py-2.5 text-xs text-slate-600 dark:text-slate-300">
                      {lead.source || "—"}
                    </td>
                    <td className="py-2.5 text-xs text-slate-700 dark:text-slate-300">
                      {deptName(lead.departmentId)}
                    </td>
                    <td className="py-2.5 text-xs text-slate-700 dark:text-slate-300">
                      {userName(lead.assignedUserId)}
                    </td>
                    <td className="py-2.5 text-xs font-medium text-slate-800 dark:text-slate-200">
                      {lead.status}
                    </td>
                    <td className="whitespace-nowrap py-2.5 text-xs text-slate-600 dark:text-slate-300">
                      {lead.nextFollowUpAt
                        ? formatFollowUpDateTime(
                            lead.nextFollowUpAt,
                            lead.followUpTimezone
                          )
                        : "—"}
                    </td>
                    <td
                      className="max-w-[140px] truncate py-2.5 text-xs text-slate-600 dark:text-slate-300"
                      title={lead.notes ?? ""}
                    >
                      {lead.notes || "—"}
                    </td>
                    <td className="whitespace-nowrap py-2.5 text-xs text-slate-500 dark:text-slate-400">
                      {lead.createdAt
                        ? new Date(lead.createdAt).toLocaleString()
                        : "—"}
                    </td>
                    <td className="py-2.5 pl-2 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => startEdit(lead)}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={deletingLeadId === lead.id}
                            onClick={() => setDeleteTargetLead(lead)}
                        >
                          {deletingLeadId === lead.id ? "Deleting..." : "Delete"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={convertingLeadId === lead.id}
                          onClick={() => void handleConvertToSale(lead.id)}
                        >
                          {convertingLeadId === lead.id ? "Converting..." : "Convert to Sales"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <TablePagination
          className="mt-4 border-t-0 pt-2"
          page={page}
          totalPages={totalPages}
          total={total}
          limit={limit}
          loading={loading}
          onPageChange={setPage}
          onLimitChange={(n) => {
            setLimit(n);
            setPage(1);
          }}
        />
      </div>
      <ConfirmDialog
        open={!!deleteTargetLead}
        title="Delete lead?"
        description={
          deleteTargetLead
            ? `Delete lead "${deleteTargetLead.clientName}"? This will remove it from active lists.`
            : ""
        }
        confirmLabel={deletingLeadId ? "Deleting..." : "Delete"}
        confirmDisabled={deletingLeadId != null}
        onCancel={() => {
          if (deletingLeadId != null) return;
          setDeleteTargetLead(null);
        }}
        onConfirm={() => void handleDeleteLead()}
      />
    </div>
  );
}
