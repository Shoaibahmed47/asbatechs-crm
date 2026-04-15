"use client";

import { useCallback, useEffect, useState } from "react";
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
};

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

  const filterClass = "form-input h-9 py-2 text-sm md:h-9 md:py-2";

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

      <div className="data-card p-4">
        <div className="mb-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="block text-[10px] font-medium uppercase text-slate-500 dark:text-slate-400">
                Search
              </label>
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Name or email"
                className={`${filterClass} mt-1 w-44`}
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium uppercase text-slate-500 dark:text-slate-400">
                Kind
              </label>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value)}
                className={`${filterClass} mt-1 min-w-[7rem]`}
              >
                <option value="">All</option>
                <option value="user">Users only</option>
                <option value="invite">Invites only</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-medium uppercase text-slate-500 dark:text-slate-400">
                Department
              </label>
              <select
                value={filterDept}
                onChange={(e) => setFilterDept(e.target.value)}
                className={`${filterClass} mt-1 min-w-[8rem]`}
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
                Role
              </label>
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className={`${filterClass} mt-1 min-w-[7rem]`}
              >
                <option value="">All</option>
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="employee">Employee</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-medium uppercase text-slate-500 dark:text-slate-400">
                Invite status
              </label>
              <select
                value={filterInviteStatus}
                onChange={(e) => setFilterInviteStatus(e.target.value)}
                className={`${filterClass} mt-1 min-w-[7rem]`}
              >
                <option value="">All</option>
                <option value="pending">Pending</option>
                <option value="accepted">Accepted</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-medium uppercase text-slate-500 dark:text-slate-400">
                User id
              </label>
              <input
                value={filterUserId}
                onChange={(e) => setFilterUserId(e.target.value.replace(/\D/g, ""))}
                placeholder="Exact id"
                className={`${filterClass} mt-1 w-24`}
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium uppercase text-slate-500 dark:text-slate-400">
                Created from
              </label>
              <input
                type="date"
                value={createdFrom}
                onChange={(e) => setCreatedFrom(e.target.value)}
                className={`${filterClass} mt-1 w-[11rem]`}
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
                className={`${filterClass} mt-1 w-[11rem]`}
              />
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={loading}
              onClick={() => void loadDirectory()}
            >
              {loading ? "Refreshing…" : "Refresh"}
            </Button>
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
          clientProjectOptions={clientProjectOptions}
          onAssignProject={allowAdminActions ? assignClientProject : undefined}
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
