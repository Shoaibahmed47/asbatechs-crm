"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CircleDollarSign } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";
import { TablePagination } from "@/components/TablePagination";
import { LeadEntryForm } from "@/components/leads/lead-entry-form";
import { ServicePurchasedTagsDisplay } from "@/components/leads/service-purchased-tags-input";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { getLocalDateString } from "@/lib/attendance-date";
import { ApiFetchError, apiFetch } from "@/lib/api-fetch";
import { leadPermissionUserMessage } from "@/lib/lead-api-errors";
import { LEAD_STAGE_OPTIONS, type LeadStage } from "@/lib/lead-workflow";
import {
  parseServicePurchasedToTags,
  serializeServicePurchasedTags
} from "@/lib/service-purchased-tags";
import { cn } from "@/lib/utils";

type SaleLead = {
  id: number;
  type: string;
  clientName: string;
  phone: string | null;
  email: string | null;
  source: string | null;
  departmentId: number | null;
  assignedUserId: number | null;
  saleAmount: string | null;
  servicePurchased: string | null;
  dateOfSale: string | null;
  notes: string | null;
  status: string;
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

const STATUS_OPTIONS = LEAD_STAGE_OPTIONS;

export default function SalesLeadsPage() {
  const [leads, setLeads] = useState<SaleLead[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [me, setMe] = useState<MeUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingLeadId, setDeletingLeadId] = useState<number | null>(null);
  const [deleteTargetLead, setDeleteTargetLead] = useState<SaleLead | null>(null);
  const [editingLeadId, setEditingLeadId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterAssign, setFilterAssign] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [saleDateFrom, setSaleDateFrom] = useState("");
  const [saleDateTo, setSaleDateTo] = useState("");

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [sort, setSort] = useState("created_at");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [sumSaleAmount, setSumSaleAmount] = useState("0");

  const [clientName, setClientName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [source, setSource] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [assignedUserId, setAssignedUserId] = useState("");
  const [saleAmount, setSaleAmount] = useState("");
  const [servicePurchasedTags, setServicePurchasedTags] = useState<string[]>([]);
  const [saleDate, setSaleDate] = useState(() => getLocalDateString());
  const [status, setStatus] = useState<LeadStage>("Won");
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
    saleDateFrom,
    saleDateTo,
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
      return `Sales leads are scoped to ${me.departmentName ?? "your department"}. You can assign to teammates in that department.`;
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
      if (saleDateFrom) params.set("saleDateFrom", saleDateFrom);
      if (saleDateTo) params.set("saleDateTo", saleDateTo);
      const data = await apiFetch<{
        leads?: SaleLead[];
        total?: number;
        totalPages?: number;
        sumSaleAmount?: string;
      }>(`/api/leads/sales?${params.toString()}`);
      setLeads(data.leads ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 0);
      setSumSaleAmount(data.sumSaleAmount ?? "0");
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
    saleDateFrom,
    saleDateTo
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

  const sortHead = (column: string, label: string) => {
    const active = sort === column;
    return (
      <th className="pb-2 text-left font-medium">
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

  const totalSales = Number(sumSaleAmount) || 0;

  function resetForm() {
    setClientName("");
    setPhone("");
    setEmail("");
    setSource("");
    setDepartmentId("");
    setAssignedUserId("");
    setSaleAmount("");
    setServicePurchasedTags([]);
    setSaleDate(getLocalDateString());
    setStatus("Won");
    setNotes("");
    setEditingLeadId(null);
    queueMicrotask(() => applyMeFormDefaults());
  }

  function startEdit(lead: SaleLead) {
    setEditingLeadId(lead.id);
    setClientName(lead.clientName ?? "");
    setPhone(lead.phone ?? "");
    setEmail(lead.email ?? "");
    setSource(lead.source ?? "");
    setDepartmentId(lead.departmentId != null ? String(lead.departmentId) : "");
    setAssignedUserId(lead.assignedUserId != null ? String(lead.assignedUserId) : "");
    setSaleAmount(lead.saleAmount ?? "");
    setServicePurchasedTags(parseServicePurchasedToTags(lead.servicePurchased));
    setSaleDate(lead.dateOfSale ?? getLocalDateString());
    setStatus((lead.status as LeadStage) ?? "Won");
    setNotes(lead.notes ?? "");
    document
      .getElementById("sale-lead-form")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const amountNum = saleAmount.trim() ? Number(saleAmount) : undefined;
      if (
        saleAmount.trim() &&
        (Number.isNaN(amountNum) || (amountNum != null && amountNum < 0))
      ) {
        toast.error("Invalid amount", {
          description: "Enter a valid sale amount (USD)."
        });
        setSaving(false);
        return;
      }

      const body: Record<string, unknown> = {
        clientName: clientName.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        source: source.trim() || undefined,
        servicePurchased: serializeServicePurchasedTags(servicePurchasedTags),
        notes: notes.trim() || undefined,
        saleDate: saleDate || undefined,
        status
      };
      if (amountNum != null && !Number.isNaN(amountNum)) {
        body.saleAmount = amountNum;
      }
      if (assignedUserId) body.assignedUserId = Number(assignedUserId);
      else body.assignedUserId = null;

      if (editingLeadId) {
        await apiFetch.patch(`/api/leads/sales/${editingLeadId}`, body);
        toast.success("Lead updated", {
          description: `${clientName.trim()} was updated successfully.`
        });
      } else {
        await apiFetch.post("/api/leads/sales", body);
        toast.success("Sale recorded", {
          description: `${clientName.trim()} was added to sales leads.`
        });
      }
      resetForm();
      await loadLeads();
    } catch (error) {
      const detail =
        error instanceof ApiFetchError
          ? leadPermissionUserMessage(error.status, error.message)
          : "Check your connection and try again.";
      toast.error(detail, {
        description: editingLeadId
          ? "Sales lead was not updated."
          : "Sales lead was not saved.",
        duration: 9000
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteLead() {
    if (!deleteTargetLead) return;
    setDeletingLeadId(deleteTargetLead.id);
    try {
      await apiFetch.post(`/api/leads/sales/${deleteTargetLead.id}/delete`);
      toast.success("Lead deleted", {
        description: `${deleteTargetLead.clientName} was removed from sales leads.`
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
          Sales leads
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Closed revenue in the unified <code className="text-xs">leads</code>{" "}
          table (<code className="text-xs">type = sale</code>) with{" "}
          <code className="text-xs">sale_amount</code>,{" "}
          <code className="text-xs">service_purchased</code>, and{" "}
          <code className="text-xs">sale_date</code>.
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
        mode="sale"
        formId="sale-lead-form"
        title={editingLeadId ? "Edit sales lead" : "Add sales lead (manual entry)"}
        submitLabel={editingLeadId ? "Update lead" : "Save lead"}
        saving={saving}
        departments={formDepartments}
        users={formUsers}
        formHint={formHint}
        submitDisabledReason={submitDisabledReason}
        departmentLocked={departmentLocked}
        statusOptions={STATUS_OPTIONS}
        clientName={clientName}
        onClientNameChange={setClientName}
        phone={phone}
        onPhoneChange={setPhone}
        email={email}
        onEmailChange={setEmail}
        source={source}
        onSourceChange={setSource}
        departmentId={departmentId}
        onDepartmentIdChange={setDepartmentId}
        showDepartment={false}
        assignedUserId={assignedUserId}
        onAssignedUserIdChange={setAssignedUserId}
        status={status}
        onStatusChange={setStatus}
        notes={notes}
        onNotesChange={setNotes}
        saleAmount={saleAmount}
        onSaleAmountChange={setSaleAmount}
        servicePurchasedTags={servicePurchasedTags}
        onServicePurchasedTagsChange={setServicePurchasedTags}
        saleDate={saleDate}
        onSaleDateChange={setSaleDate}
        onCancel={editingLeadId ? resetForm : undefined}
        cancelLabel="Cancel edit"
        onSubmit={handleCreate}
      />

      <div className="grid gap-4 md:grid-cols-[2fr,1fr]">
        <div className="data-card p-4">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              All sales leads
            </h2>
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <label className="block text-[10px] font-medium uppercase text-slate-500 dark:text-slate-400">
                  Search
                </label>
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Client, service…"
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
                  Sale from
                </label>
                <input
                  type="date"
                  value={saleDateFrom}
                  onChange={(e) => setSaleDateFrom(e.target.value)}
                  className={`${filterControlClass} mt-1 w-[11rem]`}
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium uppercase text-slate-500 dark:text-slate-400">
                  Sale to
                </label>
                <input
                  type="date"
                  value={saleDateTo}
                  onChange={(e) => setSaleDateTo(e.target.value)}
                  className={`${filterControlClass} mt-1 w-[11rem]`}
                />
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={loading}
                className="mt-5"
                onClick={() => void loadLeads()}
              >
                {loading ? "Refreshing..." : "Refresh"}
              </Button>
            </div>
          </div>
          <div className="max-h-[min(65vh,560px)] overflow-auto rounded-lg border border-slate-200/40 dark:border-slate-700/40">
            <table className="w-full min-w-[640px] table-auto text-sm">
              <thead>
                <tr className="sticky top-0 z-[1] border-b border-slate-200/80 bg-slate-50/95 text-xs uppercase text-slate-500 shadow-[0_1px_0_0_rgba(15,23,42,0.06)] backdrop-blur-sm dark:border-slate-700/80 dark:bg-slate-900/95 dark:text-slate-400 dark:shadow-[0_1px_0_0_rgba(0,0,0,0.3)]">
                  {sortHead("client_name", "Client")}
                  {sortHead("service_purchased", "Service")}
                  {sortHead("sale_amount", "Amount")}
                  {sortHead("sale_date", "Sale date")}
                  {sortHead("department_id", "Dept")}
                  {sortHead("assigned_user_id", "Assigned")}
                  {sortHead("status", "Stage")}
                  <th className="pb-2 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading && leads.length === 0 ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-slate-100/80 dark:border-slate-800/80">
                      <td className="py-3 pr-2">
                        <Skeleton className="h-4 w-32" />
                      </td>
                      <td className="py-3 pr-2">
                        <Skeleton className="h-4 w-24" />
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
                        <Skeleton className="h-4 w-24" />
                      </td>
                      <td className="py-3">
                        <Skeleton className="h-4 w-16" />
                      </td>
                      <td className="py-3 pl-2">
                        <Skeleton className="ml-auto h-7 w-20" />
                      </td>
                    </tr>
                  ))
                ) : !loading && leads.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-0">
                      <EmptyState
                        icon={CircleDollarSign}
                        title="No sales leads to show"
                        description={
                          error
                            ? "Adjust filters or refresh. You can still record a sale using the form above."
                            : "Record closed revenue here, or relax filters if records are hidden."
                        }
                      >
                        <Button
                          type="button"
                          size="sm"
                          onClick={() =>
                            document
                              .getElementById("sale-lead-form")
                              ?.scrollIntoView({ behavior: "smooth", block: "start" })
                          }
                        >
                          Record a sale
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
                      <td className="py-2 text-sm font-medium text-slate-900 dark:text-slate-100">
                        {lead.clientName}
                      </td>
                      <td className="py-2 text-xs text-slate-600 dark:text-slate-300">
                        <ServicePurchasedTagsDisplay value={lead.servicePurchased} />
                      </td>
                      <td className="py-2 text-xs text-slate-700 dark:text-slate-300">
                        {lead.saleAmount
                          ? Number(lead.saleAmount).toLocaleString(undefined, {
                              style: "currency",
                              currency: "USD"
                            })
                          : "—"}
                      </td>
                      <td className="py-2 text-xs text-slate-600 dark:text-slate-300">
                        {lead.dateOfSale
                          ? new Date(lead.dateOfSale + "T12:00:00").toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="py-2 text-xs text-slate-700 dark:text-slate-300">
                        {deptName(lead.departmentId)}
                      </td>
                      <td className="py-2 text-xs text-slate-700 dark:text-slate-300">
                        {userName(lead.assignedUserId)}
                      </td>
                      <td className="py-2 text-xs font-medium text-slate-800 dark:text-slate-200">
                        {lead.status}
                      </td>
                      <td className="py-2 pl-2 text-right">
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
        <div className="data-card p-4">
          <div className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
            Summary (filtered)
          </div>
          <div className="mt-3 text-2xl font-semibold text-slate-900 dark:text-slate-100">
            {totalSales.toLocaleString(undefined, {
              style: "currency",
              currency: "USD"
            })}
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Total sale amount for all rows matching current filters (all pages).
          </p>
        </div>
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
