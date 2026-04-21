"use client";

import { useCallback, useState, type ReactNode } from "react";
import { ChevronDown, Lock, RefreshCw, Trash2, Users } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
  department: string;
  inviteStatus: string;
  assignedClientProjects?: Array<{ projectId: number; label: string }>;
};

export type EmployeeInviteRow = {
  kind: "invite";
  id: number;
  email: string;
  department: string;
};

export type EmployeeDirectoryRow = EmployeeUserRow | EmployeeInviteRow;

export function EmployeeDirectoryTable({
  rows,
  allowAdminActions = true,
  clientProjectOptions = [],
  onAssignProject,
  onDirectoryChanged,
  currentUserId,
  sortToolbar,
  footer
}: {
  rows: EmployeeDirectoryRow[];
  /** Invite resend / password reset (admin-only APIs). */
  allowAdminActions?: boolean;
  clientProjectOptions?: Array<{ projectId: number; label: string }>;
  onAssignProject?: (userId: number, projectIds: number[]) => Promise<void>;
  onDirectoryChanged?: () => Promise<void> | void;
  currentUserId?: number | null;
  sortToolbar?: ReactNode;
  footer?: ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [selectedByUser, setSelectedByUser] = useState<Record<number, number[]>>({});
  const [savingAssignByUser, setSavingAssignByUser] = useState<Record<number, boolean>>({});

  const runAction = useCallback(
    async (
      path: string,
      body: Record<string, string>,
      successMessage: string,
      fallbackError: string
    ) => {
      if (
        !window.confirm(
          path.includes("resend-invite")
            ? `Resend the invitation email to ${body.email}?`
            : `Send a password reset link to ${body.email}?`
        )
      ) {
        return;
      }

      setBusy(true);
      try {
        await apiFetch.post(path, body);
        toast.success(successMessage, { description: body.email });
      } catch (error) {
        toast.error(error instanceof ApiFetchError ? error.message : fallbackError);
      } finally {
        setBusy(false);
      }
    },
    []
  );

  const runDeleteUser = useCallback(
    async (userId: number, email: string, role: string) => {
      if (!window.confirm(`Remove employee ${email}? This action cannot be undone.`)) {
        return;
      }
      if (role.toLowerCase() === "admin") {
        const typed = window.prompt(`Type DELETE to remove admin ${email}`);
        if (typed !== "DELETE") return;
      }
      setBusy(true);
      try {
        await apiFetch.del(`/api/users/${userId}`);
        toast.success("Employee removed", { description: email });
        await onDirectoryChanged?.();
      } catch (error) {
        toast.error(error instanceof ApiFetchError ? error.message : "Could not remove employee.");
      } finally {
        setBusy(false);
      }
    },
    [onDirectoryChanged]
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

  return (
    <div className="data-card overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50/90 dark:bg-slate-900/70">
            <tr className="border-b border-slate-200/80 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <th className="px-5 py-4">Name</th>
              <th className="px-5 py-4">Email</th>
              <th className="px-5 py-4">Role</th>
              <th className="px-5 py-4">Department</th>
              <th className="px-5 py-4">Client project</th>
              <th className="px-5 py-4 text-right">Actions</th>
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
                const showRemove = allowAdminActions && row.kind === "user" && row.id !== currentUserId;

                return (
                  <tr
                    key={row.kind === "user" ? `u-${row.id}` : `i-${row.id}`}
                    className="border-b border-slate-100/80 transition hover:bg-slate-50/70 dark:border-slate-800/80 dark:hover:bg-slate-900/40"
                  >
                    <td className="px-5 py-4">
                      <div className="font-medium text-slate-950 dark:text-white">{name}</div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {row.kind === "user" ? "Active employee record" : "Awaiting acceptance"}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-300">{email}</td>
                    <td className="px-5 py-4">
                      <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium capitalize text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        {role}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                      {row.department}
                    </td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
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
                              className="min-w-[15rem] justify-between gap-2 border-slate-600"
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
                          <DropdownMenuContent align="start" className="w-[24rem] p-2">
                            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Assigned projects {savingAssignByUser[row.id] ? "• Saving..." : ""}
                            </div>
                            <div className="max-h-64 space-y-1 overflow-y-auto">
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
                                    <span className="text-xs text-slate-700 dark:text-slate-200">
                                      {opt.label}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <span className="text-xs text-slate-400 dark:text-slate-500">
                          {row.kind === "user"
                            ? row.assignedClientProjects?.map((p) => p.label).join(", ") || "Unassigned"
                            : "—"}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end">
                        {showResend ? (
                          <Button
                            type="button"
                            size="sm"
                            className="min-w-[11rem] justify-center gap-2"
                            disabled={busy}
                            onClick={() =>
                              runAction(
                                "/api/users/resend-invite",
                                { email },
                                "Invitation sent again",
                                "Could not resend invitation."
                              )
                            }
                          >
                            <RefreshCw className="h-4 w-4" />
                            Resend invite
                          </Button>
                        ) : showReset ? (
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="min-w-[11rem] justify-center gap-2"
                              disabled={busy}
                              onClick={() =>
                                runAction(
                                  "/api/users/reset-password",
                                  { email },
                                  "Password reset link sent",
                                  "Could not send reset link."
                                )
                              }
                            >
                              <Lock className="h-4 w-4" />
                              Reset password
                            </Button>
                            {showRemove ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="min-w-[7.5rem] justify-center gap-2 border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/40"
                                disabled={busy}
                                onClick={() => void runDeleteUser(row.id, email, row.role)}
                              >
                                <Trash2 className="h-4 w-4" />
                                Remove
                              </Button>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 dark:text-slate-500">
                            —
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {footer ? <div className="border-t border-slate-200/80 px-4 py-3 dark:border-slate-800/80">{footer}</div> : null}
    </div>
  );
}
