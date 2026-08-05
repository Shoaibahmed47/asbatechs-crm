"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { AttendanceAgentHealthRow, AgentHealthState } from "@/lib/attendance-agent-health";
import { formatAttendanceDateLabel, formatAttendanceDurationReadable } from "@/lib/attendance-date";
import { AttendanceReportEmployeeDetailPanel } from "./AttendanceReportEmployeeDetailPanel";
import {
  AttendanceEmployeeScheduleModal,
  type ScheduleAnchorRect
} from "./AttendanceEmployeeScheduleModal";
import { clearInteractionLocks } from "@/lib/dom-interaction-locks";
import {
  AGENT_HEALTH_FILTER_OPTIONS,
  displayAgentHealthCounts,
  labelForDisplayAgentState,
  toneForDisplayAgentState,
  type AgentHealthFilterState
} from "@/lib/attendance-agent-health-display";
import { toast } from "sonner";

type Props = {
  detailDate: string;
  showAgentHealth: boolean;
  agentHealth: {
    rows: AttendanceAgentHealthRow[];
    counts: Record<AgentHealthState, number>;
  } | null;
  agentStateFilter: AgentHealthFilterState;
  agentFilterQueryBase: string;
  basePath?: string;
};

function formatMinutes(m: number | null | undefined): string {
  if (m == null || Number.isNaN(m)) return "—";
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}h ${mm}m`;
}

function formatAge(seconds: number | null): string {
  if (seconds == null) return "Never";
  if (seconds < 60) return `${seconds}s ago`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function labelForAttendanceStatus(status: string): string {
  if (status === "active") return "Active";
  if (status === "break") return "Break";
  if (status === "idle") return "Inactive";
  return "Offline";
}

function queryWithAgentState(
  baseQuery: string,
  state: AgentHealthFilterState,
  basePath: string
): string {
  const next = new URLSearchParams(baseQuery);
  if (state === "all") next.delete("agentState");
  else next.set("agentState", state);
  return `${basePath}?${next.toString()}`;
}

function EmployeeNameCell({
  userName
}: {
  userName: string;
}) {
  return (
    <span className="font-medium text-brand-700 dark:text-brand-300">{userName}</span>
  );
}

export function AttendanceReportTables({
  detailDate,
  showAgentHealth,
  agentHealth,
  agentStateFilter,
  agentFilterQueryBase,
  basePath
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [issuingForUserId, setIssuingForUserId] = useState<number | null>(null);
  const [scheduleModalUser, setScheduleModalUser] = useState<{
    userId: number;
    userName: string;
    anchorRect: ScheduleAnchorRect;
  } | null>(null);
  const [detailUser, setDetailUser] = useState<{ userId: number; userName: string } | null>(null);
  const filterBasePath = basePath ?? pathname;
  const displayCounts = agentHealth ? displayAgentHealthCounts(agentHealth.counts) : null;

  // Legacy links may still carry ?employee= — strip on load so the modal cannot stick open.
  useEffect(() => {
    const raw = searchParams.get("employee");
    if (!raw || !/^\d+$/.test(raw)) return;
    const next = new URLSearchParams(searchParams.toString());
    next.delete("employee");
    const q = next.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    clearInteractionLocks();
  }, [pathname, router, searchParams]);

  const openDetail = useCallback((userId: number, userName: string) => {
    clearInteractionLocks();
    setDetailUser({ userId, userName });
  }, []);

  const closeDetail = useCallback(() => {
    clearInteractionLocks();
    setDetailUser(null);
  }, []);

  const issueInstallCommand = useCallback(async (userId: number) => {
    try {
      setIssuingForUserId(userId);
      const setupRes = await fetch("/api/admin/desktop-agent-setup-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId })
      });
      if (!setupRes.ok) {
        toast.error("Could not re-issue install command.");
        return;
      }
      const setup = (await setupRes.json()) as { token: string };
      const baseUrl = window.location.origin;
      const escapedBaseUrl = baseUrl.replaceAll("'", "''");
      const escapedToken = setup.token.replaceAll("'", "''");
      const escapedExeUrl = `${baseUrl}/desktop-agent/AttendanceAgent.exe`.replaceAll("'", "''");
      const command = [
        "Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force",
        "$ErrorActionPreference = 'Stop'",
        `$url = '${escapedBaseUrl}/desktop-agent/one-click-setup.ps1'`,
        "$local = Join-Path $env:TEMP 'asba-one-click-setup.ps1'",
        "Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $local",
        `& $local -BaseUrl '${escapedBaseUrl}' -AgentExeUrl '${escapedExeUrl}' -Token '${escapedToken}'`
      ].join("\r\n");
      await navigator.clipboard.writeText(command);
      toast.success("Install command re-issued and copied.");
    } catch {
      toast.error("Could not re-issue install command.");
    } finally {
      setIssuingForUserId(null);
    }
  }, []);

  return (
    <>
      {showAgentHealth && agentHealth ? (
        <section className="dash-card overflow-hidden !rounded-[18px] sm:!rounded-[20px]">
          <div className="border-b border-[color-mix(in_srgb,var(--brand-teal-light)_18%,transparent)] bg-[color-mix(in_srgb,var(--teal-60)_75%,var(--mix-surface))] px-3 py-2.5 dark:border-slate-700 dark:bg-[color-mix(in_srgb,var(--teal-80)_70%,hsl(var(--card)))] sm:px-4 sm:py-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="dash-kicker">Desktop agent</div>
                <h2 className="dash-title mt-0.5">Agent health</h2>
                <p className="dash-subtitle mt-0.5">
                  Install/running status + live attendance. Double-click a row for details.
                </p>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5" data-testid="agent-health-filters">
              {(["all", ...AGENT_HEALTH_FILTER_OPTIONS] as const).map((state) => {
                  const isActive = agentStateFilter === state;
                  const count =
                    state === "all"
                      ? displayCounts?.all ?? agentHealth.rows.length
                      : displayCounts?.[state] ?? 0;
                  return (
                    <Link
                      key={state}
                      href={queryWithAgentState(agentFilterQueryBase, state, filterBasePath)}
                      className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold transition ${
                        isActive
                          ? "border-brand-400 bg-brand-50 text-brand-800 dark:border-brand-600 dark:bg-brand-950/40 dark:text-brand-300"
                          : "border-slate-200 bg-[var(--mix-surface)] text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                      }`}
                    >
                      {state === "all" ? "All" : labelForDisplayAgentState(state)} ({count})
                    </Link>
                  );
                }
              )}
            </div>
          </div>
          <div
            className="crm-table-shell crm-table-shell--fit"
            data-testid="agent-health-table-shell"
          >
            <table
              className="crm-table crm-table--fit text-left"
              data-testid="agent-health-table"
            >
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col" className="hidden 2xl:table-cell">
                    Email
                  </th>
                  <th scope="col" className="hidden xl:table-cell">
                    Dept
                  </th>
                  <th scope="col">Schedule</th>
                  <th scope="col">Agent</th>
                  <th scope="col">Last seen</th>
                  <th scope="col">Shift</th>
                  <th scope="col">Status</th>
                  <th
                    scope="col"
                    className="text-right"
                    title="Sleep minutes count only when laptop lock/sleep is detected during an open shift."
                  >
                    Sleep
                  </th>
                  <th scope="col" className="hidden 2xl:table-cell">
                    Reason
                  </th>
                  <th scope="col" className="text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {agentHealth.rows.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-8 text-center text-slate-500">
                      No matching employees for current agent filters.
                    </td>
                  </tr>
                ) : (
                  agentHealth.rows.map((row) => {
                    const attendanceExempt = row.attendanceExempt;
                    return (
                    <tr
                      key={row.userId}
                      role={attendanceExempt ? undefined : "button"}
                      tabIndex={attendanceExempt ? undefined : 0}
                      aria-label={
                        attendanceExempt
                          ? undefined
                          : `Double-click for attendance details — ${row.userName}`
                      }
                      onDoubleClick={() => {
                        if (attendanceExempt) return;
                        openDetail(row.userId, row.userName);
                      }}
                      onKeyDown={(event) => {
                        if (attendanceExempt) return;
                        if (event.key === "Enter") {
                          event.preventDefault();
                          openDetail(row.userId, row.userName);
                        }
                      }}
                      className={
                        attendanceExempt
                          ? "text-slate-600 dark:text-slate-400"
                          : "cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                      }
                    >
                      <td className="max-w-[10rem] truncate whitespace-nowrap sm:max-w-[14rem]">
                        <EmployeeNameCell userName={row.userName} />
                      </td>
                      <td className="hidden max-w-[12rem] truncate whitespace-nowrap text-slate-600 2xl:table-cell dark:text-slate-400">
                        {row.userEmail}
                      </td>
                      <td className="hidden whitespace-nowrap text-slate-600 xl:table-cell dark:text-slate-400">
                        {row.departmentName ?? "-"}
                      </td>
                      <td className="whitespace-nowrap">
                        {attendanceExempt ? (
                          "—"
                        ) : (
                          <button
                            type="button"
                            className="rounded-md border border-slate-300 px-1.5 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                            onMouseDown={(event) => event.stopPropagation()}
                            onClick={(event) => {
                              event.stopPropagation();
                              if (detailUser != null) closeDetail();
                              const rect = event.currentTarget.getBoundingClientRect();
                              setScheduleModalUser({
                                userId: row.userId,
                                userName: row.userName,
                                anchorRect: {
                                  top: rect.top,
                                  left: rect.left,
                                  bottom: rect.bottom,
                                  right: rect.right,
                                  width: rect.width,
                                  height: rect.height
                                }
                              });
                            }}
                          >
                            Edit
                          </button>
                        )}
                      </td>
                      <td className="whitespace-nowrap">
                        {attendanceExempt ? (
                          "—"
                        ) : (
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide ${toneForDisplayAgentState(
                            row.state
                          )}`}
                        >
                          {labelForDisplayAgentState(row.state)}
                        </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap text-slate-700 dark:text-slate-300">
                        {attendanceExempt ? (
                          "—"
                        ) : (
                          <>
                            {formatAge(row.lastSeenAgeSeconds)}
                            {row.needsAttention ? (
                              <span className="ml-1.5 rounded-full bg-rose-500/15 px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase text-rose-700 dark:text-rose-300">
                                Alert
                              </span>
                            ) : null}
                          </>
                        )}
                      </td>
                      <td className="whitespace-nowrap text-slate-700 dark:text-slate-300">
                        {attendanceExempt ? "—" : row.openShift ? "Open" : "Closed"}
                      </td>
                      <td className="whitespace-nowrap text-slate-700 dark:text-slate-300">
                        {attendanceExempt
                          ? "—"
                          : labelForAttendanceStatus(row.attendanceStatus)}
                      </td>
                      <td className="whitespace-nowrap text-right tabular-nums text-slate-700 dark:text-slate-300">
                        {attendanceExempt ? "—" : formatMinutes(row.sleepMinutes)}
                      </td>
                      <td
                        className="hidden max-w-[12rem] truncate 2xl:table-cell"
                        title={attendanceExempt ? undefined : row.attendanceReason}
                      >
                        {attendanceExempt ? "—" : row.attendanceReason}
                      </td>
                      <td className="whitespace-nowrap text-right">
                        {attendanceExempt ? (
                          "—"
                        ) : (
                        <button
                          type="button"
                          className="rounded-md border border-slate-300 px-1.5 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                          onClick={(event) => {
                            event.stopPropagation();
                            void issueInstallCommand(row.userId);
                          }}
                          disabled={issuingForUserId === row.userId}
                        >
                          {issuingForUserId === row.userId ? "…" : "Re-issue"}
                        </button>
                        )}
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {scheduleModalUser ? (
        <AttendanceEmployeeScheduleModal
          userId={scheduleModalUser.userId}
          userName={scheduleModalUser.userName}
          anchorRect={scheduleModalUser.anchorRect}
          onClose={() => setScheduleModalUser(null)}
          onSaved={() => router.refresh()}
        />
      ) : null}

      {detailUser != null ? (
        <AttendanceReportEmployeeDetailPanel
          userId={detailUser.userId}
          userName={detailUser.userName}
          date={detailDate}
          onClose={closeDetail}
        />
      ) : null}
    </>
  );
}
