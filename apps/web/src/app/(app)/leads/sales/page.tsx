"use client";

import { useCallback, useEffect, useState } from "react";
import { CircleDollarSign } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";
import { TablePagination } from "@/components/TablePagination";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getLocalDateString } from "@/lib/attendance-date";
import { ApiFetchError, apiFetch } from "@/lib/api-fetch";
import { cn } from "@/lib/utils";

type SaleLead = {
  id: number;
  type: string;
  clientName: string;
  phone: string | null;
  email: string | null;
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

const STATUS_OPTIONS = ["Closed", "Pending", "Refunded"] as const;

export default function SalesLeadsPage() {
  const [leads, setLeads] = useState<SaleLead[]>([]);
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
  const [departmentId, setDepartmentId] = useState("");
  const [assignedUserId, setAssignedUserId] = useState("");
  const [saleAmount, setSaleAmount] = useState("");
  const [servicePurchased, setServicePurchased] = useState("");
  const [saleDate, setSaleDate] = useState(() => getLocalDateString());
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>("Closed");
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
        servicePurchased: servicePurchased.trim() || undefined,
        notes: notes.trim() || undefined,
        saleDate: saleDate || undefined,
        status
      };
      if (amountNum != null && !Number.isNaN(amountNum)) {
        body.saleAmount = amountNum;
      }
      if (departmentId) body.departmentId = Number(departmentId);
      else body.departmentId = null;
      if (assignedUserId) body.assignedUserId = Number(assignedUserId);
      else body.assignedUserId = null;

      await apiFetch.post("/api/leads/sales", body);
      toast.success("Sale recorded", {
        description: `${clientName.trim()} was added to sales leads.`
      });
      setClientName("");
      setPhone("");
      setEmail("");
      setDepartmentId("");
      setAssignedUserId("");
      setSaleAmount("");
      setServicePurchased("");
      setSaleDate(getLocalDateString());
      setStatus("Closed");
      setNotes("");
      await loadLeads();
    } catch (error) {
      toast.error("Could not save sale", {
        description:
          error instanceof ApiFetchError
            ? error.message
            : "Something went wrong while saving."
      });
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

      <div className="data-card p-5" id="sale-lead-form">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Record a sale (manual entry)
        </h2>
        <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={handleCreate}>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-200">
              Client name <span className="text-red-500">*</span>
            </label>
            <input
              className="form-input mt-1"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
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
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-200">
              Sale amount (USD)
            </label>
            <input
              type="number"
              min={0}
              step="0.01"
              className="form-input mt-1"
              value={saleAmount}
              onChange={(e) => setSaleAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-200">
              Service purchased
            </label>
            <input
              className="form-input mt-1"
              value={servicePurchased}
              onChange={(e) => setServicePurchased(e.target.value)}
              placeholder="Package or SKU"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-200">
              Sale date
            </label>
            <input
              type="date"
              className="form-input mt-1"
              value={saleDate}
              onChange={(e) => setSaleDate(e.target.value)}
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
                  {u.name}
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
              className="form-input mt-1 min-h-[80px]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="md:col-span-2 flex justify-end">
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? "Saving…" : "Save sale lead"}
            </Button>
          </div>
        </form>
      </div>

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
                  {sortHead("status", "Status")}
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
                    </tr>
                  ))
                ) : !loading && leads.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-0">
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
                        {lead.servicePurchased || "—"}
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
    </div>
  );
}
