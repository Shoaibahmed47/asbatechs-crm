"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  EmployeeDirectoryTable,
  type EmployeeDirectoryRow
} from "@/components/EmployeeDirectoryTable";
import { TablePagination } from "@/components/TablePagination";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiFetchError, apiFetch } from "@/lib/api-fetch";
import { cn } from "@/lib/utils";

type Department = { id: number; name: string };

type DirectoryResponse = {
  rows?: EmployeeDirectoryRow[];
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
  departments?: Department[];
  clientProjectOptions?: Array<{ projectId: number; label: string }>;
  viewerUserId?: number;
};

const COMPACT_CONTROL = "form-input-compact";

function DirectoryFilterField({
  label,
  className,
  children
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </span>
      {children}
    </div>
  );
}

export function EmployeeDirectoryPanel({
  allowAdminActions
}: {
  allowAdminActions: boolean;
}) {
  const [rows, setRows] = useState<EmployeeDirectoryRow[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [clientProjectOptions, setClientProjectOptions] = useState<
    Array<{ projectId: number; label: string }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [sort, setSort] = useState("created_at");
  const [order, setOrder] = useState<"asc" | "desc">("desc");

  const [kind, setKind] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [filterInviteStatus, setFilterInviteStatus] = useState("");
  const [filterUserId, setFilterUserId] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");

  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [viewerUserId, setViewerUserId] = useState<number | null>(null);
  const [mobileView, setMobileView] = useState<"cards" | "table">("cards");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [
    debouncedSearch,
    kind,
    filterDept,
    filterRole,
    filterInviteStatus,
    filterUserId,
    createdFrom,
    createdTo,
    limit
  ]);

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

  const loadDirectory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      params.set("sort", sort);
      params.set("order", order);
      if (kind === "user" || kind === "invite") params.set("kind", kind);
      if (filterDept) params.set("departmentId", filterDept);
      if (filterRole) params.set("role", filterRole);
      if (filterInviteStatus) params.set("inviteStatus", filterInviteStatus);
      if (filterUserId) params.set("userId", filterUserId);
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (createdFrom) params.set("createdFrom", createdFrom);
      if (createdTo) params.set("createdTo", createdTo);

      const data = await apiFetch<DirectoryResponse>(
        `/api/users/directory?${params.toString()}`
      );
      setRows(data.rows ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 0);
      setViewerUserId(typeof data.viewerUserId === "number" ? data.viewerUserId : null);
      if (data.departments?.length) {
        setDepartments(data.departments);
      }
      setClientProjectOptions(data.clientProjectOptions ?? []);
    } catch (e) {
      if (e instanceof ApiFetchError && e.status !== 401) {
        setError(e.message);
      } else if (!(e instanceof ApiFetchError)) {
        setError("Could not load directory.");
      }
      setRows([]);
      setTotal(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  }, [
    page,
    limit,
    sort,
    order,
    kind,
    filterDept,
    filterRole,
    filterInviteStatus,
    filterUserId,
    debouncedSearch,
    createdFrom,
    createdTo
  ]);

  const assignClientProject = useCallback(
    async (userId: number, projectIds: number[]) => {
      try {
        await apiFetch.patch(`/api/users/${userId}/project-assignment`, { projectIds });
        await loadDirectory();
      } catch (e) {
        if (e instanceof ApiFetchError) {
          setError(e.message);
          return;
        }
        setError("Could not assign client project.");
      }
    },
    [loadDirectory]
  );

  const updateUserDepartment = useCallback(
    async (userId: number, departmentId: number | null) => {
      try {
        await apiFetch.patch(`/api/users/${userId}`, { departmentId });
        await loadDirectory();
      } catch (e) {
        if (e instanceof ApiFetchError) {
          setError(e.message);
          throw e;
        }
        setError("Could not update department.");
        throw e;
      }
    },
    [loadDirectory]
  );

  useEffect(() => {
    void loadDirectory();
  }, [loadDirectory]);

  const sortBtn = (key: string, label: string) => {
    const active = sort === key;
    return (
      <button
        type="button"
        className={cn(
          "inline-flex items-center gap-1 font-medium uppercase tracking-wide",
          active
            ? "text-sky-600 dark:text-sky-400"
            : "text-slate-500 dark:text-slate-400"
        )}
        onClick={() => handleSort(key)}
      >
        {label}
        {active ? (order === "asc" ? " ↑" : " ↓") : null}
      </button>
    );
  };

  const hasActiveFilters =
    Boolean(
      debouncedSearch ||
        kind ||
        filterDept ||
        filterRole ||
        filterInviteStatus ||
        filterUserId ||
        createdFrom ||
        createdTo
    );

  const clearFilters = () => {
    setSearchInput("");
    setDebouncedSearch("");
    setKind("");
    setFilterDept("");
    setFilterRole("");
    setFilterInviteStatus("");
    setFilterUserId("");
    setCreatedFrom("");
    setCreatedTo("");
    setPage(1);
  };

  return (
    <div className="space-y-4">
      {error ? (
        <div
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/35 dark:text-red-300"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <div className="data-card overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/70 bg-gradient-to-r from-slate-50/90 to-white px-4 py-3 dark:border-slate-800/80 dark:from-slate-950/40 dark:to-slate-900/20 sm:px-5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-600 dark:text-sky-300">
              Directory filters
            </p>
            {hasActiveFilters ? (
              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">Filters active</p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-slate-200/90 bg-white p-0.5 md:hidden dark:border-slate-700 dark:bg-slate-900">
              <button
                type="button"
                className={cn(
                  "rounded-md px-2.5 py-1 text-[11px] font-semibold transition",
                  mobileView === "cards"
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                    : "text-slate-600 dark:text-slate-300"
                )}
                onClick={() => setMobileView("cards")}
              >
                Cards
              </button>
              <button
                type="button"
                className={cn(
                  "rounded-md px-2.5 py-1 text-[11px] font-semibold transition",
                  mobileView === "table"
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                    : "text-slate-600 dark:text-slate-300"
                )}
                onClick={() => setMobileView("table")}
              >
                Table
              </button>
            </div>
            {hasActiveFilters ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 rounded-lg px-3 text-xs"
                onClick={clearFilters}
              >
                Clear all
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 rounded-lg px-3 text-xs"
              disabled={loading}
              onClick={() => void loadDirectory()}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </div>

        <div className="space-y-4 p-4 sm:p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12 lg:gap-x-4 lg:gap-y-3">
            <DirectoryFilterField label="Search" className="sm:col-span-2 lg:col-span-4">
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Name or email"
                className={COMPACT_CONTROL}
              />
            </DirectoryFilterField>
            <DirectoryFilterField label="Kind" className="lg:col-span-2">
              <select value={kind} onChange={(e) => setKind(e.target.value)} className={COMPACT_CONTROL}>
                <option value="">All</option>
                <option value="user">Users</option>
                <option value="invite">Invites</option>
              </select>
            </DirectoryFilterField>
            <DirectoryFilterField label="Department" className="sm:col-span-2 lg:col-span-2">
              <select
                value={filterDept}
                onChange={(e) => setFilterDept(e.target.value)}
                className={COMPACT_CONTROL}
              >
                <option value="">All</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </DirectoryFilterField>
            <DirectoryFilterField label="Role" className="lg:col-span-2">
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className={COMPACT_CONTROL}
              >
                <option value="">All</option>
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="employee">Employee</option>
              </select>
            </DirectoryFilterField>
            <DirectoryFilterField label="Invite status" className="lg:col-span-2">
              <select
                value={filterInviteStatus}
                onChange={(e) => setFilterInviteStatus(e.target.value)}
                className={COMPACT_CONTROL}
              >
                <option value="">All</option>
                <option value="pending">Pending</option>
                <option value="accepted">Accepted</option>
              </select>
            </DirectoryFilterField>
          </div>

          <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200/70 bg-slate-50/50 p-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-12 dark:border-slate-800/80 dark:bg-slate-950/20 sm:p-4">
            <DirectoryFilterField label="User ID" className="lg:col-span-2">
              <input
                value={filterUserId}
                onChange={(e) => setFilterUserId(e.target.value.replace(/\D/g, ""))}
                placeholder="e.g. 12"
                className={COMPACT_CONTROL}
              />
            </DirectoryFilterField>
            <DirectoryFilterField label="Created from" className="sm:col-span-1 lg:col-span-3">
              <input
                type="date"
                value={createdFrom}
                onChange={(e) => setCreatedFrom(e.target.value)}
                className={COMPACT_CONTROL}
              />
            </DirectoryFilterField>
            <DirectoryFilterField label="Created to" className="sm:col-span-1 lg:col-span-3">
              <input
                type="date"
                value={createdTo}
                onChange={(e) => setCreatedTo(e.target.value)}
                className={COMPACT_CONTROL}
              />
            </DirectoryFilterField>
            <div className="hidden items-end pb-0.5 lg:col-span-4 lg:flex">
              <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                Narrow by account ID or when the record was created.
              </p>
            </div>
          </div>
        </div>
      </div>

      {loading && rows.length === 0 ? (
        <div className="data-card space-y-2 p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : (
        <EmployeeDirectoryTable
          rows={rows}
          allowAdminActions={allowAdminActions}
          departments={departments}
          clientProjectOptions={clientProjectOptions}
          onAssignProject={allowAdminActions ? assignClientProject : undefined}
          onUpdateDepartment={allowAdminActions ? updateUserDepartment : undefined}
          onDirectoryChanged={loadDirectory}
          currentUserId={viewerUserId}
          mobileView={mobileView}
          sortToolbar={
            <div className="flex flex-wrap items-center gap-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              <span className="text-slate-400 dark:text-slate-500">Sort</span>
              {sortBtn("name", "Name")}
              {sortBtn("email", "Email")}
              {sortBtn("role", "Role")}
              {sortBtn("department_id", "Dept")}
              {sortBtn("created_at", "Created")}
            </div>
          }
          footer={
            <TablePagination
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
          }
        />
      )}
    </div>
  );
}
