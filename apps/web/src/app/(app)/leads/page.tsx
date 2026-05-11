"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Download, FileDown, Layers, Link2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ServicePurchasedTagsDisplay } from "@/components/leads/service-purchased-tags-input";
import { EmptyState } from "@/components/EmptyState";
import { TablePagination } from "@/components/TablePagination";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiFetchError, apiFetch } from "@/lib/api-fetch";
import { LEAD_STAGE_OPTIONS } from "@/lib/lead-workflow";
import { parseServicePurchasedToTags } from "@/lib/service-purchased-tags";
import { cn } from "@/lib/utils";

type LeadTypeFilter = "all" | "hot" | "sale";

type LeadRow = {
  id: number;
  type: "hot" | "sale";
  clientName: string;
  phone: string | null;
  email: string | null;
  source: string | null;
  departmentName: string | null;
  assignedUserName: string | null;
  assignedUserEmail: string | null;
  status: string;
  saleAmount: string | null;
  servicePurchased: string | null;
  dateOfSale: string | null;
  createdAt: string | null;
  notes: string | null;
};

type LeadExportJsonRow = {
  type: string;
  id: number;
  clientName: string;
  phone: string | null;
  email: string | null;
  source: string | null;
  departmentName: string | null;
  assignedUserName: string | null;
  assignedUserEmail: string | null;
  status: string;
  servicePurchased: string | null;
  saleAmount: string | null;
  saleDate: string | null;
  createdAt: string | null;
};

const TYPE_TABS: { value: LeadTypeFilter; label: string }[] = [
  { value: "all", label: "All Leads" },
  { value: "hot", label: "Hot Leads" },
  { value: "sale", label: "Sales Leads" }
];

function buildListQueryParams(opts: {
  page: number;
  limit: number;
  sort: string;
  order: "asc" | "desc";
  typeFilter: LeadTypeFilter;
  debouncedSearch: string;
  statusFilter: string;
}) {
  const params = new URLSearchParams();
  params.set("page", String(opts.page));
  params.set("limit", String(opts.limit));
  params.set("sort", opts.sort);
  params.set("order", opts.order);
  if (opts.typeFilter !== "all") params.set("type", opts.typeFilter);
  if (opts.debouncedSearch) params.set("search", opts.debouncedSearch);
  if (opts.statusFilter) params.set("status", opts.statusFilter);
  return params;
}

function buildExportQueryParams(opts: {
  typeFilter: LeadTypeFilter;
  debouncedSearch: string;
  statusFilter: string;
}) {
  const params = new URLSearchParams();
  if (opts.typeFilter !== "all") params.set("type", opts.typeFilter);
  if (opts.debouncedSearch) params.set("search", opts.debouncedSearch);
  if (opts.statusFilter) params.set("status", opts.statusFilter);
  return params;
}

function buildShareQueryParams(opts: {
  typeFilter: LeadTypeFilter;
  debouncedSearch: string;
  statusFilter: string;
  page: number;
  limit: number;
}) {
  const params = buildExportQueryParams(opts);
  if (opts.page > 1) params.set("page", String(opts.page));
  if (opts.limit !== 10) params.set("limit", String(opts.limit));
  return params;
}

function deletePathForLead(lead: LeadRow) {
  const segment = lead.type === "sale" ? "sales" : "hot";
  return `/api/leads/${segment}/${lead.id}/delete`;
}

function leadSelectionKey(lead: LeadRow) {
  return `${lead.type}:${lead.id}`;
}

function deletePathForKey(key: string) {
  const [t, idStr] = key.split(":");
  const id = Number(idStr);
  if (!Number.isFinite(id) || (t !== "hot" && t !== "sale")) return null;
  const segment = t === "sale" ? "sales" : "hot";
  return `/api/leads/${segment}/${id}/delete`;
}

function AllLeadsPageContent() {
  const pathname = usePathname();
  const urlQueryKey = useSearchParams().toString();

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

  const [deleteTarget, setDeleteTarget] = useState<LeadRow | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const selectAllRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(urlQueryKey);
    const t = params.get("type");
    if (t === "hot" || t === "sale") setTypeFilter(t);
    else setTypeFilter("all");
    setSearchInput(params.get("search") ?? "");
    setStatusFilter(params.get("status") ?? "");
    const p = parseInt(params.get("page") ?? "1", 10);
    if (!Number.isNaN(p) && p >= 1) setPage(p);
    const l = parseInt(params.get("limit") ?? "10", 10);
    if (!Number.isNaN(l) && l >= 1 && l <= 100) setLimit(l);
  }, [urlQueryKey]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [typeFilter, debouncedSearch, statusFilter, limit]);

  useEffect(() => {
    setSelectedKeys(new Set());
  }, [page, typeFilter, debouncedSearch, statusFilter, limit, sort, order]);

  const loadLeads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = buildListQueryParams({
        page,
        limit,
        sort,
        order,
        typeFilter,
        debouncedSearch,
        statusFilter
      });

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

  const copyShareLink = async () => {
    try {
      const params = buildShareQueryParams({
        typeFilter,
        debouncedSearch,
        statusFilter,
        page,
        limit
      });
      const qs = params.toString();
      const url = `${window.location.origin}${pathname}${qs ? `?${qs}` : ""}`;
      await navigator.clipboard.writeText(url);
      toast.success("Link copied — send it to teammates who can sign in here.");
    } catch {
      toast.error("Could not copy link.");
    }
  };

  const downloadCsv = async () => {
    setExporting(true);
    try {
      const params = buildExportQueryParams({ typeFilter, debouncedSearch, statusFilter });
      const res = await fetch(`/api/exports/leads?${params.toString()}`, {
        credentials: "same-origin"
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = typeof body?.error === "string" ? body.error : "Export failed.";
        toast.error(msg);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `leads-export-${new Date().toISOString().slice(0, 10)}.csv`;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Download started.");
    } catch {
      toast.error("Could not download export.");
    } finally {
      setExporting(false);
    }
  };

  const downloadPdf = async () => {
    setExportingPdf(true);
    try {
      const params = buildExportQueryParams({ typeFilter, debouncedSearch, statusFilter });
      params.set("format", "json");
      const res = await fetch(`/api/exports/leads?${params.toString()}`, {
        credentials: "same-origin"
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = typeof body?.error === "string" ? body.error : "Export failed.";
        toast.error(msg);
        return;
      }
      const data = (await res.json()) as { generatedAt?: string; leads: LeadExportJsonRow[] };
      const rows = data.leads ?? [];
      const stamp = new Date().toISOString().slice(0, 10);
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      let y = 10;
      doc.setFontSize(14);
      doc.text("AsbaTechs CRM — All leads export", 14, y);
      y += 6;
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      const filterBits: string[] = [];
      if (typeFilter !== "all") filterBits.push(`Type: ${typeFilter}`);
      if (debouncedSearch) filterBits.push(`Search: ${debouncedSearch}`);
      if (statusFilter) filterBits.push(`Stage: ${statusFilter}`);
      doc.text(
        `Filters: ${filterBits.length ? filterBits.join(" · ") : "none"} · Rows: ${rows.length}`,
        14,
        y
      );
      y += 4;
      doc.text(
        `Generated: ${data.generatedAt ? new Date(data.generatedAt).toLocaleString() : new Date().toLocaleString()}`,
        14,
        y
      );
      doc.setTextColor(0, 0, 0);
      y += 8;

      const head = [
        ["Type", "Client", "Contact", "Source", "Department", "Assigned", "Stage", "Service", "Amount", "Sale date", "Created"]
      ];
      const body = rows.map((l) => [
        String(l.type ?? "").toUpperCase(),
        l.clientName,
        [l.phone, l.email].filter(Boolean).join(" · ") || "—",
        l.source || "—",
        l.departmentName || "—",
        l.assignedUserName || l.assignedUserEmail || "—",
        l.status,
        parseServicePurchasedToTags(l.servicePurchased).join(" · ") || "—",
        l.saleAmount != null && l.saleAmount !== ""
          ? Number(l.saleAmount).toLocaleString(undefined, { style: "currency", currency: "USD" })
          : "—",
        l.saleDate || "—",
        l.createdAt ? new Date(l.createdAt).toLocaleString() : "—"
      ]);

      autoTable(doc, {
        startY: y,
        head,
        body,
        styles: { fontSize: 6, cellPadding: 1.2, overflow: "linebreak" },
        headStyles: { fillColor: [15, 23, 42] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: 10, right: 10 },
        tableWidth: "auto",
        showHead: "everyPage",
        horizontalPageBreak: true
      });

      doc.save(`leads-export-${stamp}.pdf`);
      toast.success("PDF download started.");
    } catch {
      toast.error("Could not build PDF.");
    } finally {
      setExportingPdf(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeletingId(deleteTarget.id);
    try {
      await apiFetch.post(deletePathForLead(deleteTarget));
      toast.success(`Removed “${deleteTarget.clientName}” from leads.`);
      setDeleteTarget(null);
      await loadLeads();
    } catch (e) {
      toast.error(e instanceof ApiFetchError ? e.message : "Delete failed.");
    } finally {
      setDeletingId(null);
    }
  };

  const selectedOnPage = leads.filter((l) => selectedKeys.has(leadSelectionKey(l)));
  const selectedCount = selectedOnPage.length;
  const allOnPageSelected = leads.length > 0 && selectedCount === leads.length;
  const someOnPageSelected = selectedCount > 0 && !allOnPageSelected;

  useEffect(() => {
    const el = selectAllRef.current;
    if (el) el.indeterminate = someOnPageSelected;
  }, [someOnPageSelected]);

  const toggleSelectAllOnPage = () => {
    if (leads.length === 0) return;
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        for (const l of leads) next.delete(leadSelectionKey(l));
      } else {
        for (const l of leads) next.add(leadSelectionKey(l));
      }
      return next;
    });
  };

  const toggleRowSelected = (lead: LeadRow) => {
    const key = leadSelectionKey(lead);
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const confirmBulkDelete = async () => {
    const keys = selectedOnPage.map(leadSelectionKey);
    if (keys.length === 0) return;
    setBulkDeleting(true);
    let ok = 0;
    let fail = 0;
    try {
      for (const key of keys) {
        const path = deletePathForKey(key);
        if (!path) {
          fail += 1;
          continue;
        }
        try {
          await apiFetch.post(path);
          ok += 1;
        } catch {
          fail += 1;
        }
      }
      if (ok > 0) {
        toast.success(`Removed ${ok} lead${ok === 1 ? "" : "s"}.`);
      }
      if (fail > 0) {
        toast.error(`${fail} lead${fail === 1 ? "" : "s"} could not be deleted (permission or network).`);
      }
      setBulkDeleteOpen(false);
      setSelectedKeys(new Set());
      await loadLeads();
    } finally {
      setBulkDeleting(false);
    }
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

        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Link href="/leads/hot" className="text-sky-700 hover:underline dark:text-sky-300">
              + Add hot lead
            </Link>
            <span className="text-slate-300">|</span>
            <Link href="/leads/sales" className="text-sky-700 hover:underline dark:text-sky-300">
              + Add sales lead
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {selectedCount > 0 ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1.5 border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40"
                onClick={() => setBulkDeleteOpen(true)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete selected ({selectedCount})
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1.5"
              disabled={exporting || exportingPdf}
              onClick={() => void downloadPdf()}
            >
              <FileDown className="h-3.5 w-3.5" />
              {exportingPdf ? "Building PDF…" : "Export PDF"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1.5"
              disabled={exporting || exportingPdf}
              onClick={() => void downloadCsv()}
            >
              <Download className="h-3.5 w-3.5" />
              {exporting ? "Exporting…" : "Export CSV"}
            </Button>
            <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => void copyShareLink()}>
              <Link2 className="h-3.5 w-3.5" />
              Copy link
            </Button>
          </div>
        </div>

        <div className="max-h-[min(65vh,560px)] overflow-auto rounded-lg border border-slate-200/40 dark:border-slate-700/40">
          <table className="w-full min-w-[1180px] table-auto text-sm">
            <thead>
              <tr className="sticky top-0 z-[1] border-b border-slate-200/80 bg-slate-50/95 text-xs uppercase text-slate-500 shadow-[0_1px_0_0_rgba(15,23,42,0.06)] backdrop-blur-sm dark:border-slate-700/80 dark:bg-slate-900/95 dark:text-slate-400">
                <th className="w-10 pb-2 pl-1 pr-0 text-left font-medium">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded border-slate-400"
                    checked={allOnPageSelected}
                    onChange={toggleSelectAllOnPage}
                    disabled={leads.length === 0 || loading}
                    aria-label="Select all leads on this page"
                  />
                </th>
                {sortHead("type", "Type")}
                {sortHead("client_name", "Client")}
                <th className="pb-2 text-left font-medium">Contact</th>
                {sortHead("source", "Source")}
                {sortHead("department_id", "Department")}
                {sortHead("assigned_user_id", "Assigned")}
                {sortHead("status", "Stage")}
                {sortHead("service_purchased", "Service")}
                {sortHead("sale_amount", "Amount")}
                {sortHead("sale_date", "Sale date")}
                {sortHead("created_at", "Created")}
                <th className="pb-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && leads.length === 0 ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-100/80 dark:border-slate-800/80">
                    <td className="py-3 pl-1 pr-0">
                      <Skeleton className="h-3.5 w-3.5" />
                    </td>
                    <td className="py-3 pr-2">
                      <Skeleton className="h-4 w-12" />
                    </td>
                    <td className="py-3 pr-2">
                      <Skeleton className="h-4 w-28" />
                    </td>
                    <td className="py-3 pr-2">
                      <Skeleton className="h-4 w-40" />
                    </td>
                    <td className="py-3 pr-2">
                      <Skeleton className="h-4 w-24" />
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
                      <Skeleton className="h-4 w-16" />
                    </td>
                    <td className="py-3 pr-2">
                      <Skeleton className="h-4 w-20" />
                    </td>
                    <td className="py-3 pr-2">
                      <Skeleton className="h-4 w-24" />
                    </td>
                    <td className="py-3">
                      <Skeleton className="ml-auto h-4 w-14" />
                    </td>
                  </tr>
                ))
              ) : !loading && leads.length === 0 ? (
                <tr>
                  <td colSpan={13} className="p-0">
                    <EmptyState
                      icon={Layers}
                      title="No leads found"
                      description="Try changing filters or add a new lead from Hot/Sales pages."
                    />
                  </td>
                </tr>
              ) : (
                leads.map((lead) => (
                  <tr key={`${lead.type}-${lead.id}`} className="border-b border-slate-100/90 last:border-b-0 dark:border-slate-800/90">
                    <td className="py-2.5 pl-1 pr-0 align-middle">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 rounded border-slate-400"
                        checked={selectedKeys.has(leadSelectionKey(lead))}
                        onChange={() => toggleRowSelected(lead)}
                        aria-label={`Select ${lead.clientName}`}
                      />
                    </td>
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
                    <td
                      className="max-w-[10rem] truncate py-2.5 text-xs text-slate-700 dark:text-slate-200"
                      title={lead.departmentName ?? undefined}
                    >
                      {lead.departmentName ?? "—"}
                    </td>
                    <td
                      className="max-w-[11rem] truncate py-2.5 text-xs text-slate-700 dark:text-slate-200"
                      title={
                        lead.assignedUserName && lead.assignedUserEmail
                          ? `${lead.assignedUserName} · ${lead.assignedUserEmail}`
                          : (lead.assignedUserEmail ?? lead.assignedUserName ?? undefined)
                      }
                    >
                      {lead.assignedUserName ?? lead.assignedUserEmail ?? "—"}
                    </td>
                    <td className="py-2.5 text-xs font-medium text-slate-800 dark:text-slate-200">
                      {lead.status}
                    </td>
                    <td className="py-2.5 text-xs text-slate-600 dark:text-slate-300">
                      {lead.type === "sale" ? (
                        <ServicePurchasedTagsDisplay value={lead.servicePurchased} />
                      ) : (
                        <span className="text-slate-600 dark:text-slate-300">—</span>
                      )}
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
                    <td className="py-2.5 text-right">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                        onClick={() => setDeleteTarget(lead)}
                        aria-label={`Delete lead ${lead.clientName}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
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
        open={deleteTarget != null}
        title="Delete this lead?"
        description={
          deleteTarget
            ? `Remove “${deleteTarget.clientName}” (${deleteTarget.type})? It will disappear from lists but stay in the database as deleted.`
            : ""
        }
        confirmLabel={deletingId != null ? "Deleting…" : "Delete"}
        confirmDisabled={deletingId != null}
        onCancel={() => {
          if (deletingId != null) return;
          setDeleteTarget(null);
        }}
        onConfirm={() => void confirmDelete()}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        title={`Delete ${selectedCount} lead${selectedCount === 1 ? "" : "s"}?`}
        description={
          selectedCount > 0
            ? `Remove the selected leads on this page (${selectedOnPage
                .slice(0, 5)
                .map((l) => l.clientName)
                .join(", ")}${selectedCount > 5 ? `, +${selectedCount - 5} more` : ""})? They will disappear from lists.`
            : ""
        }
        confirmLabel={bulkDeleting ? "Deleting…" : "Delete selected"}
        confirmDisabled={bulkDeleting}
        onCancel={() => {
          if (bulkDeleting) return;
          setBulkDeleteOpen(false);
        }}
        onConfirm={() => void confirmBulkDelete()}
      />
    </div>
  );
}

export default function AllLeadsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4 p-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-24 w-full max-w-3xl" />
        </div>
      }
    >
      <AllLeadsPageContent />
    </Suspense>
  );
}
