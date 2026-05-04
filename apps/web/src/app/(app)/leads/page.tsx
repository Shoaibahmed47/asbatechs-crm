"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Layers } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { TablePagination } from "@/components/TablePagination";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiFetchError, apiFetch } from "@/lib/api-fetch";
import { LEAD_STAGE_OPTIONS } from "@/lib/lead-workflow";
import { cn } from "@/lib/utils";

type LeadTypeFilter = "all" | "hot" | "sale";

type LeadRow = {
  id: number;
  type: "hot" | "sale";
  clientName: string;
  phone: string | null;
  email: string | null;
  source: string | null;
  status: string;
  saleAmount: string | null;
  servicePurchased: string | null;
  dateOfSale: string | null;
  createdAt: string | null;
  notes: string | null;
};

const TYPE_TABS: { value: LeadTypeFilter; label: string }[] = [
  { value: "all", label: "All Leads" },
  { value: "hot", label: "Hot Leads" },
  { value: "sale", label: "Sales Leads" }
];

export default function AllLeadsPage() {
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [typeFilter, setTypeFilter] = useState<LeadTypeFilter>("all");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [sort, setSort] = useState("created_at");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [typeFilter, debouncedSearch, statusFilter, limit]);

  const loadLeads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      params.set("sort", sort);
      params.set("order", order);
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (statusFilter) params.set("status", statusFilter);

      const data = await apiFetch<{
        leads?: LeadRow[];
        total?: number;
        totalPages?: number;
      }>(`/api/leads?${params.toString()}`);
      setLeads(data.leads ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 0);
    } catch (err) {
      if (err instanceof ApiFetchError) {
        if (err.status !== 401) setError(err.message);
      } else {
        setError("Something went wrong while loading leads.");
      }
    } finally {
      setLoading(false);
    }
  }, [page, limit, sort, order, typeFilter, debouncedSearch, statusFilter]);

  useEffect(() => {
    void loadLeads();
  }, [loadLeads]);

  const handleSort = (column: string) => {
    if (column === sort) {
      setOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSort(column);
      setOrder("desc");
    }
    setPage(1);
  };

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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">All leads</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Unified view to manage hot and sales leads from one place.
        </p>
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/35 dark:text-red-300">
          {error}
        </div>
      ) : null}

      <div className="data-card p-4">
        <div className="mb-4 flex flex-wrap items-end gap-2">
          {TYPE_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setTypeFilter(tab.value)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                typeFilter === tab.value
                  ? "border-sky-500 bg-sky-50 text-sky-700 dark:border-sky-500 dark:bg-sky-950/40 dark:text-sky-300"
                  : "border-slate-300 bg-white text-slate-600 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              )}
            >
              {tab.label}
            </button>
          ))}
          <div className="ml-auto flex flex-wrap items-end gap-2">
            <div>
              <label className="block text-[10px] font-medium uppercase text-slate-500 dark:text-slate-400">
                Search
              </label>
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Name, phone, email, service..."
                className="form-input mt-1 h-9 w-56 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium uppercase text-slate-500 dark:text-slate-400">
                Stage
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="form-input mt-1 h-9 min-w-[9rem] py-2 text-sm"
              >
                <option value="">All</option>
                {LEAD_STAGE_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={() => void loadLeads()}>
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </div>

        <div className="mb-3 flex items-center gap-2 text-xs">
          <Link href="/leads/hot" className="text-sky-700 hover:underline dark:text-sky-300">
            + Add hot lead
          </Link>
          <span className="text-slate-300">|</span>
          <Link href="/leads/sales" className="text-sky-700 hover:underline dark:text-sky-300">
            + Add sales lead
          </Link>
        </div>

        <div className="max-h-[min(65vh,560px)] overflow-auto rounded-lg border border-slate-200/40 dark:border-slate-700/40">
          <table className="w-full min-w-[880px] table-auto text-sm">
            <thead>
              <tr className="sticky top-0 z-[1] border-b border-slate-200/80 bg-slate-50/95 text-xs uppercase text-slate-500 shadow-[0_1px_0_0_rgba(15,23,42,0.06)] backdrop-blur-sm dark:border-slate-700/80 dark:bg-slate-900/95 dark:text-slate-400">
                {sortHead("type", "Type")}
                {sortHead("client_name", "Client")}
                <th className="pb-2 text-left font-medium">Contact</th>
                {sortHead("source", "Source")}
                {sortHead("status", "Stage")}
                {sortHead("service_purchased", "Service")}
                {sortHead("sale_amount", "Amount")}
                {sortHead("sale_date", "Sale date")}
                {sortHead("created_at", "Created")}
              </tr>
            </thead>
            <tbody>
              {loading && leads.length === 0 ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-100/80 dark:border-slate-800/80">
                    <td className="py-3 pr-2"><Skeleton className="h-4 w-12" /></td>
                    <td className="py-3 pr-2"><Skeleton className="h-4 w-28" /></td>
                    <td className="py-3 pr-2"><Skeleton className="h-4 w-40" /></td>
                    <td className="py-3 pr-2"><Skeleton className="h-4 w-24" /></td>
                    <td className="py-3 pr-2"><Skeleton className="h-4 w-20" /></td>
                    <td className="py-3 pr-2"><Skeleton className="h-4 w-20" /></td>
                    <td className="py-3 pr-2"><Skeleton className="h-4 w-16" /></td>
                    <td className="py-3 pr-2"><Skeleton className="h-4 w-20" /></td>
                    <td className="py-3"><Skeleton className="h-4 w-24" /></td>
                  </tr>
                ))
              ) : !loading && leads.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-0">
                    <EmptyState
                      icon={Layers}
                      title="No leads found"
                      description="Try changing filters or add a new lead from Hot/Sales pages."
                    />
                  </td>
                </tr>
              ) : (
                leads.map((lead) => (
                  <tr key={lead.id} className="border-b border-slate-100/90 last:border-b-0 dark:border-slate-800/90">
                    <td className="py-2.5 text-xs font-semibold uppercase text-slate-700 dark:text-slate-300">
                      {lead.type}
                    </td>
                    <td className="py-2.5 text-sm font-medium text-slate-900 dark:text-slate-100">
                      {lead.clientName}
                    </td>
                    <td className="py-2.5 text-xs text-slate-600 dark:text-slate-300">
                      {[lead.phone, lead.email].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className="py-2.5 text-xs text-slate-600 dark:text-slate-300">
                      {lead.source || "—"}
                    </td>
                    <td className="py-2.5 text-xs font-medium text-slate-800 dark:text-slate-200">
                      {lead.status}
                    </td>
                    <td className="py-2.5 text-xs text-slate-600 dark:text-slate-300">
                      {lead.servicePurchased || "—"}
                    </td>
                    <td className="py-2.5 text-xs text-slate-700 dark:text-slate-300">
                      {lead.saleAmount
                        ? Number(lead.saleAmount).toLocaleString(undefined, {
                            style: "currency",
                            currency: "USD"
                          })
                        : "—"}
                    </td>
                    <td className="py-2.5 text-xs text-slate-600 dark:text-slate-300">
                      {lead.dateOfSale
                        ? new Date(lead.dateOfSale + "T12:00:00").toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="py-2.5 whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">
                      {lead.createdAt ? new Date(lead.createdAt).toLocaleString() : "—"}
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

