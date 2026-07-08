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
import {
  AttendanceEarlyLeaveDetailModal,
  type AdminEarlyLeaveDetail
} from "./AttendanceEarlyLeaveDetailModal";
import {
  AttendanceLateDetailModal,
  type AdminLateDetail
} from "./AttendanceLateDetailModal";
import {
  AttendanceAbsenceDetailModal,
  type AdminAbsenceDetail
} from "./AttendanceAbsenceDetailModal";
import { anchorRectFromElement } from "@/lib/anchored-popover";
import { clearInteractionLocks } from "@/lib/dom-interaction-locks";
import {
  AGENT_HEALTH_FILTER_OPTIONS,
  displayAgentHealthCounts,
  labelActivitySource,
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
    <span className="font-medium text-sky-700 dark:text-sky-300">{userName}</span>
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
  const [lateDetail, setLateDetail] = useState<AdminLateDetail | null>(null);
  const [earlyLeaveDetail, setEarlyLeaveDetail] = useState<AdminEarlyLeaveDetail | null>(null);
  const [absenceDetail, setAbsenceDetail] = useState<{
    detail: AdminAbsenceDetail;
    anchorRect: ReturnType<typeof anchorRectFromElement>;
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

  const issueInstallCommand = useCallback(async (_userId: number) => {
    try {
      setIssuingForUserId(_userId);
      const installerUrl =
        process.env.NEXT_PUBLIC_DESKTOP_INSTALLER_URL?.trim() ||
        `${window.location.origin}/download/desktop`;
      await navigator.clipboard.writeText(installerUrl);
      toast.success("Desktop app download link copied.");
    } catch {
      toast.error("Could not copy desktop app link.");
    } finally {
      setIssuingForUserId(null);
    }
  }, []);

  return (
    <>
      {showAgentHealth && agentHealth ? (
        <section className="data-card overflow-hidden p-0">
          <div className="border-b border-slate-600/90 bg-slate-100/90 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/85">
            <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Desktop monitoring
            </div>
            <h2 className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
              Desktop app health (all employees)
            </h2>
            <p className="mt-1 text-base text-slate-600 dark:text-slate-400">
              Shows whether the AsbaTechs CRM desktop app (or legacy agent) is installed or running,
              plus live attendance status. Click any employee row for full attendance reasons.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
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
                      className={`rounded-full border px-3 py-1 text-sm font-semibold transition ${
                        isActive
                          ? "border-sky-400 bg-sky-50 text-sky-800 dark:border-sky-600 dark:bg-sky-950/40 dark:text-sky-300"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                      }`}
                    >
                      {state === "all" ? "All" : labelForDisplayAgentState(state)} ({count})
                    </Link>
                  );
                }
              )}
            </div>
          </div>
          <div className="max-h-[min(72vh,40rem)] overflow-auto">
            <table className="w-full min-w-[62rem] text-left text-sm">
              <thead className="sticky top-0 z-[1] bg-slate-50 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-900/95 dark:text-slate-400">
                <tr>
                  <th className="px-2 py-2">Name</th>
                  <th className="px-2 py-2">Email</th>
                  <th className="px-2 py-2">Department</th>
                  <th className="px-2 py-2">Schedule</th>
                  <th className="px-2 py-2">Monitor state</th>
                  <th className="px-2 py-2">Late</th>
                  <th className="px-2 py-2">Early leave</th>
                  <th className="px-2 py-2">Absence</th>
                  <th className="px-2 py-2">Last seen</th>
                  <th className="px-2 py-2">Shift</th>
                  <th className="px-2 py-2">Attendance</th>
                  <th
                    className="px-2 py-2 text-right"
                    title="Sleep minutes count only when laptop lock/sleep is detected during an open shift."
                  >
                    Sleep
                  </th>
                  <th className="px-2 py-2">Reason</th>
                  <th className="px-2 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {agentHealth.rows.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="px-4 py-10 text-center text-slate-500">
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
                          : "cursor-pointer hover:bg-slate-50/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 dark:hover:bg-slate-800/40"
                      }
                    >
                      <td className="whitespace-nowrap px-2 py-2">
                        <EmployeeNameCell userName={row.userName} />
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-slate-600 dark:text-slate-400">
                        {row.userEmail}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-slate-600 dark:text-slate-400">
                        {row.departmentName ?? "-"}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2">
                        {attendanceExempt ? (
                          "—"
                        ) : (
                          <button
                            type="button"
                            className="rounded-md border border-slate-300 px-2 py-0.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
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
                      <td className="whitespace-nowrap px-2 py-2">
                        {attendanceExempt ? (
                          "—"
                        ) : (
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-sm font-semibold uppercase tracking-wide ${toneForDisplayAgentState(
                            row.state
                          )}`}
                        >
                          {labelForDisplayAgentState(row.state)}
                        </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-slate-700 dark:text-slate-300">
                        {attendanceExempt ? (
                          "—"
                        ) : row.lateMinutes > 0 ? (
                          <button
                            type="button"
                            className="rounded-full bg-sky-500/15 px-2.5 py-0.5 text-sm font-semibold text-sky-900 hover:bg-sky-500/25 dark:text-sky-200"
                            onClick={(event) => {
                              event.stopPropagation();
                              setLateDetail({
                                userName: row.userName,
                                date: detailDate,
                                dateLabel: row.lateDateLabel ?? detailDate,
                                expectedCheckInLabel:
                                  row.expectedCheckInLabel ?? row.effectiveExpectedCheckInLabel,
                                clockInLabel: row.clockInLabel ?? "—",
                                lateMinutes: row.lateMinutes,
                                lateReason: row.lateReason,
                                lateReasonSubmittedAt: row.lateReasonSubmittedAt
                              });
                            }}
                          >
                            {formatAttendanceDurationReadable(row.lateMinutes)} late · View
                          </button>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-slate-700 dark:text-slate-300">
                        {attendanceExempt ? (
                          "—"
                        ) : row.earlyLeaveMinutes > 0 ? (
                          <button
                            type="button"
                            className="rounded-full bg-sky-500/15 px-2.5 py-0.5 text-sm font-semibold text-sky-900 hover:bg-sky-500/25 dark:text-sky-200"
                            onClick={(event) => {
                              event.stopPropagation();
                              setEarlyLeaveDetail({
                                userName: row.userName,
                                dateLabel: formatAttendanceDateLabel(detailDate),
                                expectedShiftEndLabel:
                                  row.expectedShiftEndLabel ?? "—",
                                clockOutLabel: row.clockOutLabel ?? "—",
                                earlyLeaveMinutes: row.earlyLeaveMinutes,
                                earlyLeaveReason: row.earlyLeaveReason,
                                earlyLeaveReasonSubmittedAt: row.earlyLeaveReasonSubmittedAt
                              });
                            }}
                          >
                            {formatAttendanceDurationReadable(row.earlyLeaveMinutes)} early · View
                          </button>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-slate-700 dark:text-slate-300">
                        {attendanceExempt ? (
                          "—"
                        ) : row.pendingAbsenceDateLabel ? (
                          <button
                            type="button"
                            className="rounded-full bg-rose-500/15 px-2.5 py-0.5 text-sm font-semibold text-rose-900 hover:bg-rose-500/25 dark:text-rose-200"
                            onClick={(event) => {
                              event.stopPropagation();
                              setAbsenceDetail({
                                detail: {
                                  userName: row.userName,
                                  dateLabel: row.pendingAbsenceDateLabel!,
                                  absenceReason: null,
                                  absenceReasonSubmittedAt: null
                                },
                                anchorRect: anchorRectFromElement(event.currentTarget)
                              });
                            }}
                          >
                            {row.pendingAbsenceDateLabel} · reason pending
                          </button>
                        ) : row.viewDateAbsentWithoutClockIn ? (
                          row.viewDateAbsenceReason ? (
                            <button
                              type="button"
                              className="rounded-full bg-rose-500/15 px-2.5 py-0.5 text-sm font-semibold text-rose-900 hover:bg-rose-500/25 dark:text-rose-200"
                              onClick={(event) => {
                                event.stopPropagation();
                                setAbsenceDetail({
                                  detail: {
                                    userName: row.userName,
                                    dateLabel: formatAttendanceDateLabel(detailDate),
                                    absenceReason: row.viewDateAbsenceReason,
                                    absenceReasonSubmittedAt: row.viewDateAbsenceReasonSubmittedAt
                                  },
                                  anchorRect: anchorRectFromElement(event.currentTarget)
                                });
                              }}
                            >
                              Absent · View reason
                            </button>
                          ) : (
                            <span className="text-sm font-semibold text-rose-700 dark:text-rose-300">
                              Absent · no reason
                            </span>
                          )
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-slate-700 dark:text-slate-300">
                        {attendanceExempt ? (
                          "—"
                        ) : (
                          <>
                            {formatAge(row.lastSeenAgeSeconds)}
                            {row.lastSeenSource ? (
                              <span className="ml-1 text-slate-500 dark:text-slate-400">
                                · {labelActivitySource(row.lastSeenSource)}
                              </span>
                            ) : null}
                            {row.needsAttention ? (
                              <span className="ml-2 rounded-full bg-rose-500/15 px-2 py-0.5 text-sm font-semibold uppercase text-rose-700 dark:text-rose-300">
                                Alert
                              </span>
                            ) : null}
                          </>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-slate-700 dark:text-slate-300">
                        {attendanceExempt ? "—" : row.openShift ? "Open" : "Closed"}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-slate-700 dark:text-slate-300">
                        {attendanceExempt
                          ? "—"
                          : labelForAttendanceStatus(row.attendanceStatus)}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-700 dark:text-slate-300">
                        {attendanceExempt ? "—" : formatMinutes(row.sleepMinutes)}
                      </td>
                      <td className="max-w-[24rem] px-2 py-2 text-slate-700 dark:text-slate-300">
                        {attendanceExempt ? "—" : row.attendanceReason}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-right">
                        {attendanceExempt ? (
                          "—"
                        ) : (
                        <button
                          type="button"
                          className="rounded-md border border-slate-300 px-2 py-1 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                          onClick={(event) => {
                            event.stopPropagation();
                            void issueInstallCommand(row.userId);
                          }}
                          disabled={issuingForUserId === row.userId}
                        >
                          {issuingForUserId === row.userId ? "Copying..." : "Copy app link"}
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

      {lateDetail ? (
        <AttendanceLateDetailModal detail={lateDetail} onClose={() => setLateDetail(null)} />
      ) : null}

      {earlyLeaveDetail ? (
        <AttendanceEarlyLeaveDetailModal
          detail={earlyLeaveDetail}
          onClose={() => setEarlyLeaveDetail(null)}
        />
      ) : null}

      {absenceDetail ? (
        <AttendanceAbsenceDetailModal
          detail={absenceDetail.detail}
          anchorRect={absenceDetail.anchorRect}
          onClose={() => setAbsenceDetail(null)}
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
