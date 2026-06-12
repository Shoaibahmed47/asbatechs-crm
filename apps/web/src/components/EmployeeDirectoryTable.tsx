"use client";

import { useCallback, useState, type ReactNode } from "react";
import { ChevronDown, Lock, RefreshCw, Trash2, Users } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ApiFetchError, apiFetch } from "@/lib/api-fetch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

export type EmployeeUserRow = {
  kind: "user";
  id: number;
  name: string;
  email: string;
  role: string;
  departmentId?: number | null;
  department: string;
  inviteStatus: string;
  assignedClientProjects?: Array<{ projectId: number; label: string }>;
};

export type EmployeeInviteRow = {
  kind: "invite";
  id: number;
  email: string;
  departmentId?: number | null;
  department: string;
};

export type EmployeeDirectoryRow = EmployeeUserRow | EmployeeInviteRow;

type DirectoryActionConfirm = {
  path: string;
  body: Record<string, string>;
  successMessage: string;
  fallbackError: string;
  title: string;
  description: string;
  confirmLabel: string;
};

export function EmployeeDirectoryTable({
  rows,
  allowAdminActions = true,
  departments = [],
  clientProjectOptions = [],
  onAssignProject,
  onUpdateDepartment,
  onDirectoryChanged,
  currentUserId,
  mobileView = "cards",
  sortToolbar,
  footer
}: {
  rows: EmployeeDirectoryRow[];
  /** Invite resend / password reset (admin-only APIs). */
  allowAdminActions?: boolean;
  departments?: Array<{ id: number; name: string }>;
  clientProjectOptions?: Array<{ projectId: number; label: string }>;
  onAssignProject?: (userId: number, projectIds: number[]) => Promise<void>;
  onUpdateDepartment?: (userId: number, departmentId: number | null) => Promise<void>;
  onDirectoryChanged?: () => Promise<void> | void;
  currentUserId?: number | null;
  mobileView?: "cards" | "table";
  sortToolbar?: ReactNode;
  footer?: ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [deleteTargetRow, setDeleteTargetRow] = useState<EmployeeDirectoryRow | null>(null);
  const [actionConfirm, setActionConfirm] = useState<DirectoryActionConfirm | null>(null);
  const [selectedByUser, setSelectedByUser] = useState<Record<number, number[]>>({});
  const [savingAssignByUser, setSavingAssignByUser] = useState<Record<number, boolean>>({});
  const [savingDeptByUser, setSavingDeptByUser] = useState<Record<number, boolean>>({});

  const requestActionConfirm = useCallback((action: DirectoryActionConfirm) => {
    setActionConfirm(action);
  }, []);

  const confirmDirectoryAction = useCallback(async () => {
    const action = actionConfirm;
    if (!action) return;

    setBusy(true);
    try {
      await apiFetch.post(action.path, action.body);
      toast.success(action.successMessage, { description: action.body.email });
      setActionConfirm(null);
    } catch (error) {
      toast.error(error instanceof ApiFetchError ? error.message : action.fallbackError);
    } finally {
      setBusy(false);
    }
  }, [actionConfirm]);

  const runDeleteRow = useCallback(
    async (row: EmployeeDirectoryRow) => {
      setDeleteTargetRow(row);
    },
    []
  );

  const confirmDeleteRow = useCallback(
    async () => {
      const row = deleteTargetRow;
      if (!row) return;
      const email = row.email;
      const isInvite = row.kind === "invite";
      setBusy(true);
      try {
        if (isInvite) {
          await apiFetch.del(`/api/users/invitations/${row.id}`);
          toast.success("Invitation removed", { description: email });
        } else {
          await apiFetch.del(`/api/users/${row.id}`);
          toast.success("Employee removed", { description: email });
        }
        await onDirectoryChanged?.();
      } catch (error) {
        toast.error(
          error instanceof ApiFetchError
            ? error.message
            : isInvite
              ? "Could not remove invitation."
              : "Could not remove employee."
        );
      } finally {
        setBusy(false);
        setDeleteTargetRow(null);
      }
    },
    [deleteTargetRow, onDirectoryChanged]
  );

  const getSelectedIds = (row: EmployeeUserRow): number[] =>
    selectedByUser[row.id] ?? (row.assignedClientProjects ?? []).map((p) => p.projectId);

  const saveAssignments = async (userId: number, projectIds: number[]) => {
    if (!onAssignProject) return;
    setSavingAssignByUser((prev) => ({ ...prev, [userId]: true }));
    try {
      await onAssignProject(userId, projectIds);
      toast.success("Project assignments updated");
    } catch {
      toast.error("Could not update project assignments");
    } finally {
      setSavingAssignByUser((prev) => ({ ...prev, [userId]: false }));
    }
  };

  const toggleSelectedProject = (row: EmployeeUserRow, projectId: number) => {
    let next: number[] = [];
    setSelectedByUser((prev) => {
      const currentFromState = prev[row.id] ?? (row.assignedClientProjects ?? []).map((p) => p.projectId);
      const has = currentFromState.includes(projectId);
      next = has
        ? currentFromState.filter((id) => id !== projectId)
        : [...currentFromState, projectId];
      return { ...prev, [row.id]: next };
    });
    void saveAssignments(row.id, next);
  };

  const updateDepartment = async (row: EmployeeUserRow, departmentIdValue: string) => {
    if (!onUpdateDepartment) return;
    const parsedDepartmentId =
      departmentIdValue === "" ? null : Number(departmentIdValue);
    const nextDepartmentId =
      parsedDepartmentId == null || Number.isNaN(parsedDepartmentId)
        ? null
        : parsedDepartmentId;
    setSavingDeptByUser((prev) => ({ ...prev, [row.id]: true }));
    try {
      await onUpdateDepartment(row.id, nextDepartmentId);
      toast.success("Department updated");
    } catch {
      toast.error("Could not update department");
    } finally {
      setSavingDeptByUser((prev) => ({ ...prev, [row.id]: false }));
    }
  };

  return (
    <div className="data-card overflow-hidden p-0 shadow-sm">
      {sortToolbar ? (
        <div className="border-b border-slate-200/80 px-4 py-2.5 dark:border-slate-800/80">
          <div className="overflow-x-auto">{sortToolbar}</div>
        </div>
      ) : null}
      <div className={`${mobileView === "table" ? "block" : "hidden"} md:hidden`}>
        {rows.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No team members yet"
            description="When people are added or invited, they will appear in this directory."
          />
        ) : (
          <div className="space-y-3 p-3">
            {rows.map((row) => {
              const email = row.email;
              const role = row.kind === "user" ? row.role : "Pending";
              const showResend =
                allowAdminActions &&
                (row.kind === "invite" ||
                  (row.kind === "user" && row.inviteStatus === "pending"));
              const showReset =
                allowAdminActions &&
                row.kind === "user" &&
                row.inviteStatus !== "pending";
              const showRemove =
                allowAdminActions &&
                (row.kind === "invite" ||
                  (row.kind === "user" &&
                    row.role.toLowerCase() !== "admin" &&
                    row.id !== currentUserId));

              return (
                <article
                  key={row.kind === "user" ? `mobile-u-${row.id}` : `mobile-i-${row.id}`}
                  className="rounded-xl border border-slate-200/80 bg-white p-3 dark:border-slate-800 dark:bg-slate-900/70"
                >
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {row.kind === "user" ? row.name : "Pending invitation"}
                  </div>
                  <div className="mt-1 text-base text-slate-600 dark:text-slate-300">{email}</div>
                  <div className="mt-1 text-base text-slate-500 dark:text-slate-400">
                    {role} · {row.department || "Unassigned"}
                  </div>
                  <div className="mt-3 flex flex-col gap-2">
                    {showResend ? (
                      <Button
                        type="button"
                        size="sm"
                        className="w-full justify-center gap-2"
                        disabled={busy}
                        onClick={() =>
                          requestActionConfirm({
                            path: "/api/users/resend-invite",
                            body: { email },
                            successMessage: "Invitation sent again",
                            fallbackError: "Could not resend invitation.",
                            title: "Resend invitation?",
                            description: `Send another invitation email to ${email}?`,
                            confirmLabel: "Resend invite"
                          })
                        }
                      >
                        <RefreshCw className="h-4 w-4" />
                        Resend invite
                      </Button>
                    ) : null}
                    {showReset ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="w-full justify-center gap-2"
                        disabled={busy}
                        onClick={() =>
                          requestActionConfirm({
                            path: "/api/users/reset-password",
                            body: { email },
                            successMessage: "Password reset link sent",
                            fallbackError: "Could not send reset link.",
                            title: "Reset password?",
                            description: `Send a password reset link to ${email}? They will receive an email with instructions.`,
                            confirmLabel: "Send reset link"
                          })
                        }
                      >
                        <Lock className="h-4 w-4" />
                        Reset password
                      </Button>
                    ) : null}
                    {showRemove ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="w-full justify-center gap-2 border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/40"
                        disabled={busy}
                        onClick={() => void runDeleteRow(row)}
                      >
                        <Trash2 className="h-4 w-4" />
                        Remove
                      </Button>
                    ) : null}
                    {!showResend && !showReset && !showRemove ? (
                      <span className="text-center text-base text-slate-400 dark:text-slate-500">—</span>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <div className={`overflow-x-auto ${mobileView === "table" ? "block" : "hidden md:block"}`}>
        <table className="min-w-[64rem] table-fixed text-left text-sm lg:min-w-full">
          <thead className="bg-slate-50/90 dark:bg-slate-900/70">
            <tr className="border-b border-slate-200/80 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <th className="w-[17rem] px-4 py-2.5">Name</th>
              <th className="hidden w-[17rem] px-4 py-2.5 md:table-cell">Email</th>
              <th className="hidden w-[7rem] px-4 py-2.5 md:table-cell">Role</th>
              <th className="hidden w-[11rem] px-4 py-2.5 md:table-cell">Department</th>
              <th className="hidden w-[15rem] px-4 py-2.5 lg:table-cell">Client project</th>
              <th className="w-[11rem] px-4 py-2.5">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-0">
                  <EmptyState
                    icon={Users}
                    title="No team members yet"
                    description="When people are added or invited, they will appear in this directory."
                  />
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const email = row.email;
                const name = row.kind === "user" ? row.name : "Pending invitation";
                const role = row.kind === "user" ? row.role : "Pending";
                const showResend =
                  allowAdminActions &&
                  (row.kind === "invite" ||
                    (row.kind === "user" && row.inviteStatus === "pending"));
                const showReset =
                  allowAdminActions &&
                  row.kind === "user" &&
                  row.inviteStatus !== "pending";
                const showRemove =
                  allowAdminActions &&
                  (row.kind === "invite" ||
                    (row.kind === "user" &&
                      row.role.toLowerCase() !== "admin" &&
                      row.id !== currentUserId));

                return (
                  <tr
                    key={row.kind === "user" ? `u-${row.id}` : `i-${row.id}`}
                    className="border-b border-slate-100/80 transition hover:bg-slate-50/70 dark:border-slate-800/80 dark:hover:bg-slate-900/40"
                  >
                    <td className="px-4 py-3 align-middle">
                      <div className="font-medium text-slate-950 dark:text-white">{name}</div>
                      <div className="mt-1 text-base text-slate-500 dark:text-slate-400">
                        {row.kind === "user" ? "Active employee record" : "Awaiting acceptance"}
                      </div>
                      <div className="mt-1 space-y-0.5 text-base text-slate-500 dark:text-slate-400 md:hidden">
                        <div>{email}</div>
                        <div className="capitalize">{role}</div>
                        <div>{row.department || "Unassigned"}</div>
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 align-middle text-slate-600 dark:text-slate-300 md:table-cell">
                      <span className="block truncate" title={email}>
                        {email}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 align-middle md:table-cell">
                      <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-sm font-medium capitalize text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        {role}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 align-middle text-slate-600 dark:text-slate-300 md:table-cell">
                      {allowAdminActions && row.kind === "user" && onUpdateDepartment ? (
                        <div className="flex min-w-0 items-center gap-2">
                          <select
                            className="form-input-compact max-w-[11rem]"
                            value={
                              row.departmentId == null ? "" : String(row.departmentId)
                            }
                            onChange={(e) => void updateDepartment(row, e.target.value)}
                            disabled={!!savingDeptByUser[row.id]}
                          >
                            <option value="">Unassigned</option>
                            {departments.map((department) => (
                              <option key={department.id} value={department.id}>
                                {department.name}
                              </option>
                            ))}
                          </select>
                          {savingDeptByUser[row.id] ? (
                            <span className="text-base text-slate-400">Saving...</span>
                          ) : null}
                        </div>
                      ) : (
                        <span className="block truncate">{row.department || "Unassigned"}</span>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 align-middle text-slate-600 dark:text-slate-300 lg:table-cell">
                      {allowAdminActions &&
                      row.kind === "user" &&
                      row.role.toLowerCase() === "employee" &&
                      onAssignProject ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 w-full max-w-[12rem] justify-between gap-1.5 rounded-lg border border-slate-200/90 bg-white px-2 text-sm font-normal shadow-none dark:border-slate-700 dark:bg-slate-900"
                            >
                              <span className="truncate text-left">
                                {(() => {
                                  const selectedIds = getSelectedIds(row);
                                  if (selectedIds.length === 0) return "Select project(s)";
                                  const labels = clientProjectOptions
                                    .filter((opt) => selectedIds.includes(opt.projectId))
                                    .map((opt) => opt.label);
                                  return labels.join(", ");
                                })()}
                              </span>
                              <ChevronDown className="h-4 w-4 shrink-0 opacity-70" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-[20rem] p-2">
                            <div className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                              Assigned projects {savingAssignByUser[row.id] ? "• Saving..." : ""}
                            </div>
                            <div className="max-h-56 space-y-1 overflow-y-auto">
                              {clientProjectOptions.map((opt) => {
                                const checked = getSelectedIds(row).includes(opt.projectId);
                                return (
                                  <label
                                    key={opt.projectId}
                                    className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => toggleSelectedProject(row, opt.projectId)}
                                      className="mt-0.5 h-4 w-4 rounded border-slate-400 bg-transparent"
                                    />
                                    <span className="text-base text-slate-700 dark:text-slate-200">
                                      {opt.label}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <span className="block truncate text-base text-slate-400 dark:text-slate-500">
                          {row.kind === "user"
                            ? row.assignedClientProjects?.map((p) => p.label).join(", ") || "Unassigned"
                            : "—"}
                        </span>
                      )}
                    </td>
                    <td className="w-[11rem] px-4 py-3 align-top">
                      <div className="flex w-full min-w-[9.5rem] flex-col items-stretch gap-1.5">
                        {showResend ? (
                          <Button
                            type="button"
                            size="sm"
                            className="h-8 justify-center gap-1.5 rounded-lg px-2.5 text-sm"
                            disabled={busy}
                            onClick={() =>
                              requestActionConfirm({
                                path: "/api/users/resend-invite",
                                body: { email },
                                successMessage: "Invitation sent again",
                                fallbackError: "Could not resend invitation.",
                                title: "Resend invitation?",
                                description: `Send another invitation email to ${email}?`,
                                confirmLabel: "Resend invite"
                              })
                            }
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            Resend invite
                          </Button>
                        ) : null}

                        {showReset ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 justify-center gap-1.5 rounded-lg px-2.5 text-sm"
                            disabled={busy}
                            onClick={() =>
                              requestActionConfirm({
                                path: "/api/users/reset-password",
                                body: { email },
                                successMessage: "Password reset link sent",
                                fallbackError: "Could not send reset link.",
                                title: "Reset password?",
                                description: `Send a password reset link to ${email}? They will receive an email with instructions.`,
                                confirmLabel: "Send reset link"
                              })
                            }
                          >
                            <Lock className="h-3.5 w-3.5" />
                            Reset password
                          </Button>
                        ) : null}

                        {showRemove ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 justify-center gap-1.5 rounded-lg border-red-900/60 px-2.5 text-sm text-red-500 hover:bg-red-950/20 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/40"
                            disabled={busy}
                            onClick={() => void runDeleteRow(row)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Remove
                          </Button>
                        ) : null}

                        {!showResend && !showReset && !showRemove ? (
                          <span className="px-0.5 text-base text-slate-400 dark:text-slate-500">—</span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <ConfirmDialog
        open={!!actionConfirm}
        title={actionConfirm?.title ?? ""}
        description={actionConfirm?.description ?? ""}
        confirmLabel={busy ? "Sending..." : actionConfirm?.confirmLabel ?? "Confirm"}
        confirmDisabled={busy}
        onCancel={() => {
          if (busy) return;
          setActionConfirm(null);
        }}
        onConfirm={() => void confirmDirectoryAction()}
      />
      <ConfirmDialog
        open={!!deleteTargetRow}
        title="Remove employee?"
        description={
          deleteTargetRow
            ? `Remove ${
                deleteTargetRow.kind === "invite" ? "pending invite" : "employee"
              } ${deleteTargetRow.email}? This action cannot be undone.`
            : ""
        }
        confirmLabel={busy ? "Removing..." : "Remove"}
        confirmDisabled={busy}
        onCancel={() => {
          if (busy) return;
          setDeleteTargetRow(null);
        }}
        onConfirm={() => void confirmDeleteRow()}
      />
      {footer ? <div className="border-t border-slate-200/80 px-4 py-3 dark:border-slate-800/80">{footer}</div> : null}
    </div>
  );
}
