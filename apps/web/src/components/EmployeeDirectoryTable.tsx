"use client";

import { useCallback, useState } from "react";
import { RefreshCw, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

export type EmployeeUserRow = {
  kind: "user";
  id: number;
  name: string;
  email: string;
  role: string;
  department: string;
  inviteStatus: string;
};

export type EmployeeInviteRow = {
  kind: "invite";
  id: number;
  email: string;
  department: string;
};

export type EmployeeDirectoryRow = EmployeeUserRow | EmployeeInviteRow;

export function EmployeeDirectoryTable({
  rows
}: {
  rows: EmployeeDirectoryRow[];
}) {
  const [banner, setBanner] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);

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

      setBanner(null);
      setBusy(true);
      try {
        const res = await fetch(path, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
        const data = await res.json().catch(() => null);

        if (!res.ok) {
          setBanner({
            type: "error",
            text:
              typeof data?.error === "string" ? data.error : fallbackError
          });
          return;
        }

        setBanner({ type: "success", text: successMessage });
      } catch {
        setBanner({ type: "error", text: fallbackError });
      } finally {
        setBusy(false);
      }
    },
    []
  );

  const headerGridClass =
    "grid w-full grid-cols-[minmax(0,20%)_minmax(0,26%)_minmax(0,12%)_minmax(0,18%)_minmax(0,24%)] border-b-[3px] border-double border-slate-300 bg-slate-100/95 text-xs font-semibold uppercase tracking-wide text-slate-600";

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      {banner && (
        <div className="px-4 pb-4 pt-4">
          <div
            className={`rounded-md border px-3 py-2 text-xs ${
              banner.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {banner.text}
          </div>
        </div>
      )}
      {/* Full-width strip outside the table so the gray background spans evenly */}
      <div className={headerGridClass}>
        <div className="min-w-0 px-3 py-3 text-left">Name</div>
        <div className="min-w-0 px-3 py-3 text-left">Email</div>
        <div className="min-w-0 px-3 py-3 text-left">Role</div>
        <div className="min-w-0 px-3 py-3 text-left">Department</div>
        <div className="min-w-0 px-3 py-3 text-center">Actions</div>
      </div>
      <div className="px-0 pb-4">
        <table className="w-full table-fixed text-sm" aria-label="Employee directory">
          <colgroup>
            <col className="w-[20%]" />
            <col className="w-[26%]" />
            <col className="w-[12%]" />
            <col className="w-[18%]" />
            <col className="w-[24%]" />
          </colgroup>
          <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={5}
                className="px-3 py-4 text-center text-xs text-slate-500"
              >
                No employees or pending invitations.
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const email = row.email;
              const name = row.kind === "user" ? row.name : row.email;
              const role = row.kind === "user" ? row.role : "—";
              const dept =
                row.kind === "user" ? row.department : row.department;

              const showResend =
                row.kind === "invite" ||
                (row.kind === "user" && row.inviteStatus === "pending");
              const showReset =
                row.kind === "user" && row.inviteStatus !== "pending";

              return (
                <tr
                  key={row.kind === "user" ? `u-${row.id}` : `i-${row.id}`}
                  className="border-b border-slate-50 last:border-b-0"
                >
                  <td className="px-3 py-2 text-sm text-slate-900">{name}</td>
                  <td className="px-3 py-2 text-xs text-slate-600">{email}</td>
                  <td className="px-3 py-2 text-xs capitalize text-slate-700">
                    {role}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-700">{dept}</td>
                  <td className="px-3 py-2 text-center align-middle">
                    <div className="mx-auto flex min-h-[2.25rem] w-fit max-w-full flex-wrap items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-2 py-1.5">
                      {showResend ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="default"
                          className="h-9 min-w-[11.5rem] shrink-0 justify-center gap-2 px-3 text-xs font-medium shadow-sm"
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
                          <RefreshCw className="h-4 w-4 shrink-0 opacity-90" />
                          Resend Invite
                        </Button>
                      ) : showReset ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="default"
                          className="h-9 min-w-[11.5rem] shrink-0 justify-center gap-2 px-3 text-xs font-medium shadow-sm"
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
                          <Lock className="h-4 w-4 shrink-0 opacity-90" />
                          Reset Password
                        </Button>
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
    </div>
  );
}
