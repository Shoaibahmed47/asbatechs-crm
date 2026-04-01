"use client";

import { useCallback, useEffect, useState } from "react";
import { Flame } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";
import { TablePagination } from "@/components/TablePagination";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiFetchError, apiFetch } from "@/lib/api-fetch";
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
  createdAt: string | null;
};

type Department = { id: number; name: string };
type UserRow = { id: number; name: string; email: string };

const STATUS_OPTIONS = ["New", "Contacted", "Follow Up", "Closed"] as const;

export default function HotLeadsPage() {
  const [leads, setLeads] = useState<HotLead[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  const [sort, setSort] = useState("created_at");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [clientName, setClientName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [source, setSource] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [assignedUserId, setAssignedUserId] = useState("");
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>("New");
  const [notes, setNotes] = useState("");

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
        const [d, u] = await Promise.all([
          apiFetch<{ departments?: Department[] }>("/api/departments"),
          apiFetch<{ users?: UserRow[] }>("/api/users")
        ]);
        setDepartments(d.departments ?? []);
        setUsers(u.users ?? []);
      } catch {
        setDepartments([]);
        setUsers([]);
      }
    }
    void loadMeta();
  }, []);

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

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        clientName: clientName.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        source: source.trim() || undefined,
        status,
        notes: notes.trim() || undefined
      };
      if (departmentId) body.departmentId = Number(departmentId);
      else body.departmentId = null;
      if (assignedUserId) body.assignedUserId = Number(assignedUserId);
      else body.assignedUserId = null;

      await apiFetch.post("/api/leads/hot", body);
      toast.success("Hot lead saved", {
        description: `${clientName.trim()} was added to your pipeline.`
      });
      setClientName("");
      setPhone("");
      setEmail("");
      setSource("");
      setDepartmentId("");
      setAssignedUserId("");
      setStatus("New");
      setNotes("");
      await loadLeads();
    } catch (error) {
      toast.error(
        "Could not save lead",
        {
          description:
            error instanceof ApiFetchError
              ? error.message
              : "Something went wrong while saving."
        }
      );
    } finally {
      setSaving(false);
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

      <div className="data-card p-5" id="hot-lead-form">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Add hot lead (manual entry)
        </h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Required: client name. Optional: phone, email, source, department,
          assignee, notes.
        </p>
        <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={handleCreate}>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-200">
              Client name <span className="text-red-500">*</span>
            </label>
            <input
              className="form-input mt-1"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Company or contact name"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-200">
              Phone
            </label>
            <input
              className="form-input mt-1"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 …"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-200">
              Email
            </label>
            <input
              type="email"
              className="form-input mt-1"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-200">
              Source
            </label>
            <input
              className="form-input mt-1"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="Referral, website, event…"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-200">
              Department
            </label>
            <select
              className="form-input mt-1"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
            >
              <option value="">Unassigned</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-200">
              Assigned user
            </label>
            <select
              className="form-input mt-1"
              value={assignedUserId}
              onChange={(e) => setAssignedUserId(e.target.value)}
            >
              <option value="">Auto assign (round robin)</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-200">
              Status
            </label>
            <select
              className="form-input mt-1"
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as (typeof STATUS_OPTIONS)[number])
              }
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-200">
              Notes
            </label>
            <textarea
              className="form-input mt-1 min-h-[88px]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Context, next step, objections…"
            />
          </div>
          <div className="md:col-span-2 flex justify-end">
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? "Saving…" : "Save hot lead"}
            </Button>
          </div>
        </form>
      </div>

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
                Status
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
                <th className="pb-2 text-left font-medium">Notes</th>
                {sortHead("created_at", "Created")}
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
                    <td className="py-3">
                      <Skeleton className="h-4 w-24" />
                    </td>
                  </tr>
                ))
              ) : !loading && leads.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-0">
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
                      {lead.clientName}
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
    </div>
  );
}
