"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { AttendanceAgentHealthRow, AgentHealthState } from "@/lib/attendance-agent-health";
import type { AttendanceDailyRow, AttendanceRangeRow } from "@/lib/attendance-daily-report";
import { AttendanceReportEmployeeDetailPanel } from "./AttendanceReportEmployeeDetailPanel";
import { toast } from "sonner";

type Props = {
  detailDate: string;
  showAgentHealth: boolean;
  agentHealth: {
    rows: AttendanceAgentHealthRow[];
    counts: Record<AgentHealthState, number>;
  } | null;
  agentStateFilter: AgentHealthState | "all";
  agentFilterQueryBase: string;
  dailyRows: AttendanceDailyRow[];
  rangeRows: AttendanceRangeRow[];
};

function formatClock(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

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

function labelForAgentState(state: AgentHealthState): string {
  if (state === "running") return "Running";
  if (state === "installed") return "Installed";
  if (state === "stale") return "No recent activity";
  return "Not installed";
}

function toneForAgentState(state: AgentHealthState): string {
  if (state === "running") return "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300";
  if (state === "installed") return "bg-sky-500/15 text-sky-800 dark:text-sky-300";
  if (state === "stale") return "bg-amber-500/15 text-amber-900 dark:text-amber-300";
  return "bg-slate-200/80 text-slate-700 dark:bg-slate-800 dark:text-slate-400";
}

function queryWithAgentState(baseQuery: string, state: AgentHealthState | "all"): string {
  const next = new URLSearchParams(baseQuery);
  if (state === "all") next.delete("agentState");
  else next.set("agentState", state);
  return `/attendance/report?${next.toString()}`;
}

function EmployeeNameCell({
  userName
}: {
  userName: string;
}) {
  return (
    <span className="font-medium text-sky-700 dark:text-sky-300">{userName}</span>
  );
}

export function AttendanceReportTables({
  detailDate,
  showAgentHealth,
  agentHealth,
  agentStateFilter,
  agentFilterQueryBase,
  dailyRows,
  rangeRows
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [issuingForUserId, setIssuingForUserId] = useState<number | null>(null);

  const selectedUserId = useMemo(() => {
    const raw = searchParams.get("employee");
    if (!raw || !/^\d+$/.test(raw)) return null;
    return Number(raw);
  }, [searchParams]);

  const selectedUserName = useMemo(() => {
    if (selectedUserId == null) return "";
    const fromAgent = agentHealth?.rows.find((r) => r.userId === selectedUserId)?.userName;
    if (fromAgent) return fromAgent;
    const fromDaily = dailyRows.find((r) => r.userId === selectedUserId)?.userName;
    if (fromDaily) return fromDaily;
    return rangeRows.find((r) => r.userId === selectedUserId)?.userName ?? "Employee";
  }, [selectedUserId, agentHealth?.rows, dailyRows, rangeRows]);

  const openDetail = useCallback(
    (userId: number, _userName: string) => {
      const next = new URLSearchParams(searchParams.toString());
      next.set("employee", String(userId));
      router.push(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const closeDetail = useCallback(() => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("employee");
    const q = next.toString();
    router.push(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  const issueInstallCommand = useCallback(async (userId: number) => {
    try {
      setIssuingForUserId(userId);
      const setupRes = await fetch("/api/admin/attendance/agent/setup-token", {
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
        <section className="data-card overflow-hidden p-0">
          <div className="border-b border-slate-200/90 bg-slate-100/90 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/85">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Desktop agent
            </div>
            <h2 className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
              Agent health (all employees)
            </h2>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              Shows which employee machines are running the attendance agent and who has no recent activity.
              Click any employee row for full attendance reasons.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(["all", "running", "installed", "stale", "not_installed"] as const).map(
                (state) => {
                  const isActive = agentStateFilter === state;
                  const count =
                    state === "all"
                      ? agentHealth.rows.length
                      : agentHealth.counts[state as AgentHealthState];
                  return (
                    <Link
                      key={state}
                      href={queryWithAgentState(agentFilterQueryBase, state)}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                        isActive
                          ? "border-sky-400 bg-sky-50 text-sky-800 dark:border-sky-600 dark:bg-sky-950/40 dark:text-sky-300"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                      }`}
                    >
                      {state === "all" ? "All" : labelForAgentState(state)} ({count})
                    </Link>
                  );
                }
              )}
            </div>
          </div>
          <div className="max-h-[min(40vh,22rem)] overflow-auto">
            <table className="w-full min-w-[62rem] text-left text-sm">
              <thead className="sticky top-0 z-[1] bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-900/95 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Agent state</th>
                  <th className="px-4 py-3">Last heartbeat</th>
                  <th className="px-4 py-3">Last seen source</th>
                  <th className="px-4 py-3">Last seen</th>
                  <th className="px-4 py-3">Shift</th>
                  <th className="px-4 py-3">Attendance</th>
                  <th
                    className="px-4 py-3 text-right"
                    title="Sleep minutes count only when laptop lock/sleep is detected during an open shift."
                  >
                    Sleep
                  </th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {agentHealth.rows.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-4 py-10 text-center text-slate-500">
                      No matching employees for current agent filters.
                    </td>
                  </tr>
                ) : (
                  agentHealth.rows.map((row) => (
                    <tr
                      key={row.userId}
                      role="button"
                      tabIndex={0}
                      aria-label={`Open attendance details for ${row.userName}`}
                      onClick={() => openDetail(row.userId, row.userName)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openDetail(row.userId, row.userName);
                        }
                      }}
                      className="cursor-pointer hover:bg-slate-50/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 dark:hover:bg-slate-800/40"
                    >
                      <td className="whitespace-nowrap px-4 py-2.5">
                        <EmployeeNameCell userName={row.userName} />
                      </td>
                      <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">
                        {row.userEmail}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">
                        {row.departmentName ?? "-"}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${toneForAgentState(
                            row.state
                          )}`}
                        >
                          {labelForAgentState(row.state)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300">
                        {row.lastAgentActivityAt ? formatClock(row.lastAgentActivityAt) : "-"}
                      </td>
                      <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300">
                        {row.lastSeenSource ?? "-"}
                      </td>
                      <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300">
                        {formatAge(row.lastSeenAgeSeconds)}
                        {row.needsAttention ? (
                          <span className="ml-2 rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-rose-700 dark:text-rose-300">
                            Alert
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300">
                        {row.openShift ? "Open" : "Closed"}
                      </td>
                      <td className="px-4 py-2.5 capitalize text-slate-700 dark:text-slate-300">
                        {row.attendanceStatus}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-300">
                        {formatMinutes(row.sleepMinutes)}
                      </td>
                      <td className="max-w-[24rem] px-4 py-2.5 text-slate-700 dark:text-slate-300">
                        {row.attendanceReason}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          type="button"
                          className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                          onClick={(event) => {
                            event.stopPropagation();
                            void issueInstallCommand(row.userId);
                          }}
                          disabled={issuingForUserId === row.userId}
                        >
                          {issuingForUserId === row.userId ? "Issuing..." : "Re-issue install"}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {selectedUserId != null ? (
        <AttendanceReportEmployeeDetailPanel
          userId={selectedUserId}
          userName={selectedUserName}
          date={detailDate}
          onClose={closeDetail}
        />
      ) : null}
    </>
  );
}

