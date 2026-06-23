"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  HelpCircle,
  Info,
  Laptop,
  PanelTop
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AttendanceDateRangeCalendar,
  formatAttendanceRangeLabel
} from "@/components/attendance/AttendanceDateRangeCalendar";
import { AttendanceAbsenceExplanationModal } from "@/components/attendance/AttendanceAbsenceExplanationModal";
import { AttendanceEarlyLeaveExplanationModal } from "@/components/attendance/AttendanceEarlyLeaveExplanationModal";
import { AttendanceLateExplanationModal } from "@/components/attendance/AttendanceLateExplanationModal";
/* FUTURE: end-break popup
import { AttendanceEndBreakModal } from "@/components/attendance/AttendanceEndBreakModal";
*/
import { AttendancePunctualityCard } from "@/components/attendance/AttendancePunctualityCard";
import { AttendanceStartBreakModal } from "@/components/attendance/AttendanceStartBreakModal";
import { TablePagination } from "@/components/TablePagination";
import { ApiFetchError, apiFetch } from "@/lib/api-fetch";
import { breakSessionReasonLabel } from "@/lib/attendance-break-label";
import {
  enumerateLocalDates,
  formatAttendanceClock,
  formatAttendanceDateLabel,
  formatWorkDuration,
  getLocalDateString
} from "@/lib/attendance-date";
import type { ComplianceAwayCause } from "@/lib/attendance-away-compliance";
import { ATTENDANCE_ACTIVITY_PING_MS, ATTENDANCE_AWAY_POLICY } from "@/lib/attendance-policy";
import type { PendingEarlyLeaveExplanation } from "@/lib/attendance-early-leave-types";
import type { PendingAbsenceExplanation } from "@/lib/attendance-absence-types";
import type { PendingLateExplanation } from "@/lib/attendance-late-types";
import type { EmployeePunctualityStats } from "@/lib/attendance-punctuality-shared";
import { ATTENDANCE_EXTRA_BREAK_ENABLED } from "@/lib/attendance-policy";
import { UNSCHEDULED_CAUSE } from "@/lib/attendance-reason";
import {
  agentStateHintForDisplay,
  employeeAgentBadgeClass,
  labelForDisplayAgentState
} from "@/lib/attendance-agent-health-display";
import {
  isAdminRole,
  isEmployeeRole,
  isManagerRole,
  normalizeRole
} from "@/lib/rbac";
import {
  ATTENDANCE_WEEKEND_OFF_MESSAGE,
  isAttendanceWeekendToday
} from "@/lib/attendance-working-days";

type AttendanceStatus = "active" | "break" | "idle" | "offline";

type BreakSessionRow = {
  id: number;
  breakStart: string | null;
  breakEnd: string | null;
  breakType?: string | null;
  breakCategory?: string | null;
  startNote?: string | null;
  endNote?: string | null;
  unscheduledCause?: string | null;
  returnReason?: string | null;
  logDate?: string;
};

type Attendance = {
  id: number;
  date: string;
  carriedOvernight?: boolean;
  clockIn: string | null;
  clockOut: string | null;
  totalWorkMinutes: number | null;
  totalBreakMinutes: number | null;
  unscheduledIdleMinutes?: number | null;
  idleEventsCount?: number | null;
  sleepMinutes?: number | null;
  sleepEventsCount?: number | null;
  lastActivityAt?: string | null;
  totalHours?: string | null;
  liveWorkMinutes?: number | null;
  liveBreakMinutes?: number | null;
  totalSleepMinutesLive?: number | null;
  totalHoursLive?: string | null;
  breakSessions?: BreakSessionRow[];
  status: AttendanceStatus;
};

type AgentHealthState = "not_installed" | "installed" | "running" | "stale";

type AgentHealth = {
  state: AgentHealthState;
  statusLabel: string;
  openShift: boolean;
  lastActivityAt: string | null;
  lastActivitySource: string | null;
  lastActivityAgeSeconds: number | null;
  recommendedAction: string;
  appUrl: string;
};

type ViewerRole = "admin" | "manager" | "employee" | string;

type AwayCause = ComplianceAwayCause;

type AwayPolicy = {
  tabCloseAwaySeconds: number;
  cursorIdleAwaySeconds: number;
  laptopSleepAwaySeconds: number;
  cursorIdleEnabled: boolean;
  lateExplanationTestMode?: boolean;
};

type AwayNoticeState =
  | { type: "away"; cause: AwayCause }
  | { type: "tab_returned"; closedAt: string; awaySeconds: number };

/** On-page away prompts (sleep). Tab close uses TAB_CLOSE_RETURNED_NOTICE. */
const AWAY_EMPLOYEE_NOTICE: Record<typeof UNSCHEDULED_CAUSE.SLEEP, string> = {
  [UNSCHEDULED_CAUSE.SLEEP]:
    "Your laptop was locked or went to sleep. Wake your laptop, then move your mouse or click anywhere to continue."
};

/* FUTURE: mouse/keyboard idle — re-enable with ATTENDANCE_CURSOR_IDLE_ENABLED
const AWAY_EMPLOYEE_NOTICE_CURSOR_IDLE =
  "No mouse or keyboard activity was detected. Move your cursor or click anywhere to continue.";
*/

const AWAY_NOTICE_META: Record<typeof UNSCHEDULED_CAUSE.SLEEP, { label: string; icon: typeof Laptop }> = {
  [UNSCHEDULED_CAUSE.SLEEP]: { label: "Sleep / lock", icon: Laptop }
};

/* FUTURE: mouse/keyboard idle notice meta
import { MousePointer2 } from "lucide-react";
const AWAY_NOTICE_META_CURSOR_IDLE = { label: "Inactivity", icon: MousePointer2 };
*/

function formatAwaySecondsLabel(seconds: number): string {
  if (seconds < 60) return `${seconds} second${seconds === 1 ? "" : "s"}`;
  const mins = Math.floor(seconds / 60);
  const rem = seconds % 60;
  if (rem === 0) return `${mins} minute${mins === 1 ? "" : "s"}`;
  return `${mins}m ${rem}s`;
}

function AttendanceTabCloseReturnedNotice({
  closedAt,
  awaySeconds
}: {
  closedAt: string;
  awaySeconds: number;
}) {
  const closedLabel = formatAttendanceClock(closedAt);
  const durationLabel = formatAwaySecondsLabel(awaySeconds);

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex gap-3 rounded-2xl border border-sky-200/90 bg-gradient-to-r from-sky-50/90 via-white to-white px-4 py-4 shadow-sm dark:border-sky-800/60 dark:from-sky-950/25 dark:via-slate-950 dark:to-slate-950"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sky-200/80 bg-white text-sky-600 dark:border-sky-800/70 dark:bg-sky-950/50 dark:text-sky-300">
        <PanelTop className="h-5 w-5" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-base font-semibold leading-snug text-sky-800 dark:text-sky-200">
            Attendance tab reopened
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200/80 bg-sky-50/90 px-3 py-1 text-base font-semibold leading-snug text-sky-800 dark:border-sky-800/60 dark:bg-sky-950/40 dark:text-sky-200">
            <AlertCircle className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
            Shared with admin
          </span>
        </div>
        <p className="mt-2 text-base leading-relaxed text-slate-700 dark:text-slate-300">
          You closed the Attendance browser tab at <strong className="text-slate-900 dark:text-slate-100">{closedLabel}</strong>.
          Your manager was notified. You were away for{" "}
          <strong className="text-slate-900 dark:text-slate-100">{durationLabel}</strong>.
          Other websites or tabs are fine — keep this Attendance tab open while clocked in.
        </p>
      </div>
    </div>
  );
}

function AttendanceAwayNotice({
  cause
}: {
  cause: typeof UNSCHEDULED_CAUSE.SLEEP;
}) {
  const meta = AWAY_NOTICE_META[cause];
  const Icon = meta.icon;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex gap-3 rounded-2xl border border-sky-200/90 bg-gradient-to-r from-sky-50/90 via-white to-white px-4 py-4 shadow-sm dark:border-sky-800/60 dark:from-sky-950/25 dark:via-slate-950 dark:to-slate-950"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sky-200/80 bg-white text-sky-600 dark:border-sky-800/70 dark:bg-sky-950/50 dark:text-sky-300">
        <Icon className="h-5 w-5" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-base font-semibold leading-snug text-sky-800 dark:text-sky-200">
            {meta.label}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200/80 bg-sky-50/90 px-3 py-1 text-base font-semibold leading-snug text-sky-800 dark:border-sky-800/60 dark:bg-sky-950/40 dark:text-sky-200">
            <AlertCircle className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
            Admin notified
          </span>
        </div>
        <p className="mt-2 text-base leading-relaxed text-slate-700 dark:text-slate-300">
          {AWAY_EMPLOYEE_NOTICE[cause]}
        </p>
        <p className="mt-2 text-base leading-relaxed text-slate-500 dark:text-slate-400">
          Move your mouse or click anywhere to continue. No typing required.
        </p>
      </div>
    </div>
  );
}

const BREAK_MINUTES_HINT = `Total time today when you were not counted as working while clocked in. Includes official breaks and auto-detected away time (closing this Attendance tab or laptop sleep) once each lasts about ${ATTENDANCE_AWAY_POLICY.tabCloseAwaySeconds} seconds or longer. Switching to other browser tabs or sites does not count. Work hours = time since clock in minus break minutes.`;

function AttendanceStatTile({
  label,
  value,
  valueClassName,
  hint
}: {
  label: string;
  value: string;
  valueClassName?: string;
  hint?: string;
}) {
  const [hintOpen, setHintOpen] = useState(false);
  const hintId = useId();

  return (
    <div className="relative rounded-xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/90 px-3 py-2.5 shadow-sm dark:border-slate-700/90 dark:from-slate-900/80 dark:to-slate-950/50">
      <div className="flex items-center gap-1 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        <span>{label}</span>
        {hint ? (
          <button
            type="button"
            className="inline-flex shrink-0 rounded-full text-slate-400 transition hover:text-sky-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 dark:text-slate-500 dark:hover:text-sky-400"
            aria-label={`About ${label}`}
            aria-expanded={hintOpen}
            aria-controls={hintId}
            onClick={() => setHintOpen((open) => !open)}
            onBlur={(event) => {
              if (!event.currentTarget.parentElement?.contains(event.relatedTarget as Node | null)) {
                setHintOpen(false);
              }
            }}
          >
            <HelpCircle className="h-3.5 w-3.5" aria-hidden />
          </button>
        ) : null}
      </div>
      {hint && hintOpen ? (
        <div
          id={hintId}
          role="tooltip"
          className="absolute left-0 top-full z-30 mt-1.5 w-[min(18rem,calc(100vw-2rem))] rounded-lg border border-slate-200/90 bg-white p-2.5 text-sm normal-case leading-relaxed tracking-normal text-slate-600 shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
        >
          {hint}
        </div>
      ) : null}
      <div
        className={`mt-1 text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100 ${valueClassName ?? ""}`}
      >
        {value}
      </div>
    </div>
  );
}

function formatTimeAgo(seconds: number | null): string {
  if (seconds == null) return "Never";
  if (seconds < 60) return `${seconds}s ago`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

type AttendancePageClientProps = {
  initialRole?: string;
};

export default function AttendancePageClient({
  initialRole = ""
}: AttendancePageClientProps) {
  const router = useRouter();
  const [attendance, setAttendance] = useState<Attendance | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [agentHealth, setAgentHealth] = useState<AgentHealth | null>(null);
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [installerReady, setInstallerReady] = useState<boolean | null>(null);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [installCommand, setInstallCommand] = useState("");
  const [verifyRetryInSeconds, setVerifyRetryInSeconds] = useState(0);
  const [viewerRole, setViewerRole] = useState<ViewerRole>(initialRole);
  const [profileReady, setProfileReady] = useState(Boolean(initialRole));
  const [employeeEmail, setEmployeeEmail] = useState("");
  const [selectedDate, setSelectedDate] = useState(() => getLocalDateString());
  const [dateFrom, setDateFrom] = useState(() => getLocalDateString());
  const [dateTo, setDateTo] = useState(() => getLocalDateString());
  const [rangeBreakSessions, setRangeBreakSessions] = useState<BreakSessionRow[]>([]);
  const [rangeBreaksLoading, setRangeBreaksLoading] = useState(false);
  const [breakPage, setBreakPage] = useState(1);
  const [breakLimit, setBreakLimit] = useState(10);
  const [showExtraBreakModal, setShowExtraBreakModal] = useState(false);
  const [extraBreakReason, setExtraBreakReason] = useState("");
  const [showStartBreakModal, setShowStartBreakModal] = useState(false);
  const [startBreakSubmitting, setStartBreakSubmitting] = useState(false);
  const [startBreakError, setStartBreakError] = useState<string | null>(null);
  const [showEndBreakModal, setShowEndBreakModal] = useState(false);
  const [endBreakSubmitting, setEndBreakSubmitting] = useState(false);
  const [endBreakError, setEndBreakError] = useState<string | null>(null);
  const [awayNotice, setAwayNotice] = useState<AwayNoticeState | null>(null);
  const [pendingLateExplanation, setPendingLateExplanation] =
    useState<PendingLateExplanation | null>(null);
  const [lateExplanationLoading, setLateExplanationLoading] = useState(false);
  const [lateExplanationSubmitting, setLateExplanationSubmitting] = useState(false);
  const [lateExplanationError, setLateExplanationError] = useState<string | null>(null);
  const [lateExplanationTestMode, setLateExplanationTestMode] = useState(false);
  const [pendingEarlyLeaveExplanation, setPendingEarlyLeaveExplanation] =
    useState<PendingEarlyLeaveExplanation | null>(null);
  const [earlyLeaveExplanationSubmitting, setEarlyLeaveExplanationSubmitting] =
    useState(false);
  const [earlyLeaveExplanationError, setEarlyLeaveExplanationError] = useState<string | null>(
    null
  );
  const [pendingAbsenceExplanation, setPendingAbsenceExplanation] =
    useState<PendingAbsenceExplanation | null>(null);
  const [absenceExplanationSubmitting, setAbsenceExplanationSubmitting] =
    useState(false);
  const [absenceExplanationError, setAbsenceExplanationError] = useState<string | null>(null);
  const [punctualityStats, setPunctualityStats] = useState<EmployeePunctualityStats | null>(
    null
  );
  const [punctualityLoading, setPunctualityLoading] = useState(false);

  const lastPingAtRef = useRef<number>(0);
  const agentHealthRef = useRef<AgentHealth | null>(null);
  const agentHealthSilentInflightRef = useRef<Promise<AgentHealth | null> | null>(null);
  const agentHealthManualInflightRef = useRef<Promise<AgentHealth | null> | null>(null);
  const sleepAwayPendingRef = useRef(false);
  const awayPolicyRef = useRef({
    tabCloseMs: 10_000,
    cursorIdleMs: 10_000,
    laptopSleepMs: 10_000,
    cursorIdleEnabled: false
  });
  /* FUTURE: mouse/keyboard idle tracking ref
  const cursorAwayActiveRef = useRef(false);
  */
  const tabCloseReturnHandledRef = useRef<number | null>(null);
  const lastCursorAtRef = useRef(Date.now());

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const data = await apiFetch<{ attendance?: Attendance | null }>(
        `/api/attendance/me?date=${encodeURIComponent(selectedDate)}`,
        { timeoutMs: 45_000 }
      );
      setAttendance(data.attendance ?? null);
      setLastUpdated(new Date());
    } catch (error) {
      if (error instanceof ApiFetchError && error.status !== 401) {
        setError(error.message || "Unable to load attendance for this date.");
      } else if (!(error instanceof ApiFetchError)) {
        setError("Unable to load attendance for this date.");
      }
    }
  }, [selectedDate]);

  const postActivityEvent = useCallback(
    async (
      event:
        | "activity"
        | "lock"
        | "unlock"
        | "away_start"
        | "away_end",
      extras?: { reason?: string; awayCause?: AwayCause }
    ) => {
      try {
        return await apiFetch.post<{
          awaySeconds?: number;
          autoReason?: string;
        }>("/api/attendance/activity", {
          event,
          source: "browser",
          observedAt: new Date().toISOString(),
          awayCause: extras?.awayCause
        });
      } catch {
        return null;
      }
    },
    []
  );

  useEffect(() => {
    void apiFetch<{ away: AwayPolicy }>("/api/attendance/policy")
      .then((policy) => {
        awayPolicyRef.current = {
          tabCloseMs: policy.away.tabCloseAwaySeconds * 1000,
          cursorIdleMs: policy.away.cursorIdleAwaySeconds * 1000,
          laptopSleepMs: policy.away.laptopSleepAwaySeconds * 1000,
          cursorIdleEnabled: policy.away.cursorIdleEnabled
        };
        setLateExplanationTestMode(Boolean(policy.away.lateExplanationTestMode));
      })
      .catch(() => {
        // Defaults from awayPolicyRef already match server policy file.
      });
  }, []);

  const applyAgentHealth = useCallback((status: AgentHealth) => {
    agentHealthRef.current = status;
    setAgentHealth(status);
  }, []);

  const refreshAgentHealth = useCallback(
    async (options?: { silent?: boolean }): Promise<AgentHealth | null> => {
      const inflightRef = options?.silent
        ? agentHealthSilentInflightRef
        : agentHealthManualInflightRef;

      if (inflightRef.current) {
        return inflightRef.current;
      }

      const run = async (): Promise<AgentHealth | null> => {
        if (!options?.silent) {
          setAgentError(null);
        }
        setAgentLoading(true);
        try {
          const status = await apiFetch<AgentHealth>(
            "/api/attendance/desktop-agent/status",
            { timeoutMs: 45_000 }
          );
          applyAgentHealth(status);
          setAgentError(null);
          return status;
        } catch (error) {
          if (!options?.silent) {
            if (error instanceof ApiFetchError && error.status !== 401) {
              setAgentError(error.message || "Unable to verify desktop agent.");
            } else if (!(error instanceof ApiFetchError)) {
              setAgentError("Unable to verify desktop agent.");
            }
          }
          return null;
        } finally {
          setAgentLoading(false);
        }
      };

      const promise = run().finally(() => {
        inflightRef.current = null;
      });
      inflightRef.current = promise;
      return promise;
    },
    [applyAgentHealth]
  );

  const verifyAgentNow = useCallback(async () => {
    const cached = agentHealthRef.current;
    if (cached && cached.state !== "not_installed") {
      setVerifyRetryInSeconds(0);
      setAgentError(null);
      toast.success(`Agent status: ${cached.statusLabel}`);
      void refreshAgentHealth({ silent: true });
      return;
    }

    const status = await refreshAgentHealth();
    const effective = status ?? agentHealthRef.current;
    if (!effective || effective.state === "not_installed") {
      setVerifyRetryInSeconds(8);
      toast.error(
        "Could not reach server for agent status. If the badge shows Running, you can Clock in."
      );
      return;
    }
    setVerifyRetryInSeconds(0);
    setAgentError(null);
    toast.success(`Agent status: ${effective.statusLabel}`);
  }, [refreshAgentHealth]);

  const loadPendingExplanations = useCallback(async () => {
    if (!isEmployeeRole(viewerRole)) {
      setPendingLateExplanation(null);
      setPendingEarlyLeaveExplanation(null);
      setPendingAbsenceExplanation(null);
      return;
    }
    setLateExplanationLoading(true);
    setLateExplanationError(null);
    setEarlyLeaveExplanationError(null);
    setAbsenceExplanationError(null);
    try {
      const [lateData, earlyData, absenceData] = await Promise.all([
        apiFetch<{ pending: PendingLateExplanation | null }>(
          "/api/attendance/late-explanation"
        ),
        apiFetch<{ pending: PendingEarlyLeaveExplanation | null }>(
          "/api/attendance/early-leave-explanation"
        ),
        apiFetch<{ pending: PendingAbsenceExplanation | null }>(
          "/api/attendance/absence-explanation"
        )
      ]);
      setPendingLateExplanation(lateData.pending ?? null);
      setPendingEarlyLeaveExplanation(earlyData.pending ?? null);
      setPendingAbsenceExplanation(absenceData.pending ?? null);
    } catch (error) {
      if (error instanceof ApiFetchError && error.status !== 401) {
        setLateExplanationError(error.message || "Could not load explanation status.");
      }
    } finally {
      setLateExplanationLoading(false);
    }
  }, [viewerRole]);

  const submitLateExplanation = useCallback(
    async (reason: string) => {
      if (!pendingLateExplanation) return;
      setLateExplanationSubmitting(true);
      setLateExplanationError(null);
      try {
        const data = await apiFetch.post<{
          success: boolean;
          nextPending: PendingLateExplanation | null;
        }>("/api/attendance/late-explanation", {
          attendanceLogId: pendingLateExplanation.attendanceLogId,
          reason
        });
        setPendingLateExplanation(data.nextPending ?? null);
        toast.success("Late explanation submitted.");
        void loadPendingExplanations();
      } catch (error) {
        setLateExplanationError(
          error instanceof ApiFetchError
            ? error.message
            : "Could not submit late explanation."
        );
      } finally {
        setLateExplanationSubmitting(false);
      }
    },
    [pendingLateExplanation, loadPendingExplanations]
  );

  const submitEarlyLeaveExplanation = useCallback(
    async (reason: string) => {
      if (!pendingEarlyLeaveExplanation) return;
      setEarlyLeaveExplanationSubmitting(true);
      setEarlyLeaveExplanationError(null);
      try {
        const data = await apiFetch.post<{
          success: boolean;
          nextPending: PendingEarlyLeaveExplanation | null;
        }>("/api/attendance/early-leave-explanation", {
          attendanceLogId: pendingEarlyLeaveExplanation.attendanceLogId,
          reason
        });
        setPendingEarlyLeaveExplanation(data.nextPending ?? null);
        toast.success("Early leave explanation submitted.");
        void loadPendingExplanations();
      } catch (error) {
        setEarlyLeaveExplanationError(
          error instanceof ApiFetchError
            ? error.message
            : "Could not submit early leave explanation."
        );
      } finally {
        setEarlyLeaveExplanationSubmitting(false);
      }
    },
    [pendingEarlyLeaveExplanation, loadPendingExplanations]
  );

  const submitAbsenceExplanation = useCallback(
    async (reason: string) => {
      if (!pendingAbsenceExplanation) return;
      setAbsenceExplanationSubmitting(true);
      setAbsenceExplanationError(null);
      try {
        const data = await apiFetch.post<{
          success: boolean;
          nextPending: PendingAbsenceExplanation | null;
        }>("/api/attendance/absence-explanation", {
          date: pendingAbsenceExplanation.date,
          reason
        });
        setPendingAbsenceExplanation(data.nextPending ?? null);
        toast.success("Absence explanation submitted.");
        void loadPendingExplanations();
      } catch (error) {
        setAbsenceExplanationError(
          error instanceof ApiFetchError
            ? error.message
            : "Could not submit absence explanation."
        );
      } finally {
        setAbsenceExplanationSubmitting(false);
      }
    },
    [pendingAbsenceExplanation, loadPendingExplanations]
  );

  const refreshMyProfile = useCallback(async () => {
    try {
      const me = await apiFetch<{
        user: { email?: string | null; role?: ViewerRole | null } | null;
      }>("/api/auth/me");
      if (me.user) {
        setViewerRole(normalizeRole(me.user.role ?? ""));
        setEmployeeEmail(me.user.email?.trim() || "");
      }
    } catch {
      // Non-blocking.
    } finally {
      setProfileReady(true);
    }
  }, []);

  const checkInstallerAvailability = useCallback(async () => {
    try {
      const browserOrigin =
        typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
      const baseUrl = agentHealth?.appUrl || browserOrigin;
      const res = await fetch(`${baseUrl}/desktop-agent/AttendanceAgent.exe`, {
        method: "GET",
        credentials: "include"
      });
      setInstallerReady(res.ok);
    } catch {
      setInstallerReady(false);
    }
  }, [agentHealth?.appUrl]);

  const normalizedViewerRole = normalizeRole(viewerRole);
  const isEmployeeViewer = isEmployeeRole(normalizedViewerRole);
  const shouldRedirectToReport =
    isAdminRole(normalizedViewerRole) || isManagerRole(normalizedViewerRole);
  const isViewingToday = selectedDate === getLocalDateString();
  const isWeekendToday = isAttendanceWeekendToday();
  const isMultiDayRange = dateFrom !== dateTo;
  const shiftOpen = Boolean(attendance?.clockIn && !attendance?.clockOut);
  const canManageLiveShift =
    isViewingToday ||
    Boolean(shiftOpen && attendance?.date && selectedDate === attendance.date);

  const loadPunctuality = useCallback(async () => {
    if (!isEmployeeViewer) return;
    setPunctualityLoading(true);
    try {
      const data = await apiFetch<{ stats: EmployeePunctualityStats }>(
        "/api/attendance/punctuality",
        { timeoutMs: 30_000 }
      );
      setPunctualityStats(data.stats);
    } catch {
      setPunctualityStats(null);
    } finally {
      setPunctualityLoading(false);
    }
  }, [isEmployeeViewer]);

  useEffect(() => {
    void loadPunctuality();
  }, [loadPunctuality]);

  useEffect(() => {
    if (!isEmployeeViewer || !attendance?.breakSessions) return;
    const openAway = attendance.breakSessions.find(
      (session) => !session.breakEnd && session.unscheduledCause === "sleep"
    );
    if (!openAway?.unscheduledCause) {
      sleepAwayPendingRef.current = false;
      return;
    }
  /* FUTURE: mouse/keyboard idle open-away notice
    const openAway = attendance.breakSessions.find(
      (session) =>
        !session.breakEnd &&
        (session.unscheduledCause === "cursor_idle" || session.unscheduledCause === "sleep")
    );
    if (cause === UNSCHEDULED_CAUSE.CURSOR_IDLE && awayPolicyRef.current.cursorIdleEnabled) {
      setAwayNotice({ type: "away", cause });
    }
  */
    sleepAwayPendingRef.current = true;
    setAwayNotice({ type: "away", cause: UNSCHEDULED_CAUSE.SLEEP });
  }, [attendance?.breakSessions, isEmployeeViewer]);

  useEffect(() => {
    if (!isEmployeeViewer || !canManageLiveShift) return;
    if (!shiftOpen) {
      tabCloseReturnHandledRef.current = null;
      return;
    }

    const openTabClose = attendance?.breakSessions?.find(
      (session) =>
        !session.breakEnd &&
        session.unscheduledCause === UNSCHEDULED_CAUSE.TAB_CLOSE
    );
    if (!openTabClose) return;
    if (tabCloseReturnHandledRef.current === openTabClose.id) return;
    tabCloseReturnHandledRef.current = openTabClose.id;

    void (async () => {
      const result = await postActivityEvent("away_end", {
        awayCause: UNSCHEDULED_CAUSE.TAB_CLOSE
      });
      const awaySeconds =
        typeof result?.awaySeconds === "number" ? result.awaySeconds : 0;
      setAwayNotice({
        type: "tab_returned",
        closedAt: openTabClose.breakStart ?? new Date().toISOString(),
        awaySeconds
      });
      await refresh();
    })();
  }, [
    attendance?.breakSessions,
    attendance?.clockIn,
    attendance?.clockOut,
    isEmployeeViewer,
    canManageLiveShift,
    shiftOpen,
    postActivityEvent,
    refresh
  ]);

  useEffect(() => {
    if (shouldRedirectToReport) {
      router.replace("/dashboard");
    }
  }, [router, shouldRedirectToReport]);

  useEffect(() => {
    if (!isEmployeeViewer || !isMultiDayRange) {
      setRangeBreakSessions([]);
      return;
    }

    let cancelled = false;
    setRangeBreaksLoading(true);

    async function loadRangeBreaks() {
      const days = enumerateLocalDates(dateFrom, dateTo).slice(-62);
      const merged: BreakSessionRow[] = [];

      for (const day of days) {
        try {
          const data = await apiFetch<{ attendance?: Attendance | null }>(
            `/api/attendance/me?date=${encodeURIComponent(day)}`
          );
          const sessions = data.attendance?.breakSessions ?? [];
          for (const session of sessions) {
            merged.push({ ...session, logDate: day });
          }
        } catch {
          // Skip days that fail to load.
        }
      }

      if (!cancelled) {
        setRangeBreakSessions(merged);
        setRangeBreaksLoading(false);
      }
    }

    void loadRangeBreaks();
    return () => {
      cancelled = true;
    };
  }, [dateFrom, dateTo, isEmployeeViewer, isMultiDayRange]);

  useEffect(() => {
    void refresh();
    void refreshAgentHealth({ silent: true });
    void refreshMyProfile();
  }, [refresh, refreshAgentHealth, refreshMyProfile, isEmployeeViewer]);

  useEffect(() => {
    if (!isEmployeeViewer) return;
    void loadPendingExplanations();
  }, [isEmployeeViewer, loadPendingExplanations]);

  useEffect(() => {
    if (!isEmployeeViewer) return;
    void checkInstallerAvailability();
  }, [isEmployeeViewer, checkInstallerAvailability]);

  useEffect(() => {
    setBreakPage(1);
  }, [selectedDate]);

  useEffect(() => {
    if (verifyRetryInSeconds <= 0) return;
    const ticker = window.setInterval(() => {
      setVerifyRetryInSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(ticker);
  }, [verifyRetryInSeconds]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (canManageLiveShift) {
        void refresh();
      }
      void refreshAgentHealth({ silent: true });
    }, 20000);
    return () => window.clearInterval(id);
  }, [canManageLiveShift, refresh, refreshAgentHealth]);

  useEffect(() => {
    if (!isEmployeeViewer || !shiftOpen || !attendance?.date) return;
    const calendarToday = getLocalDateString();
    if (selectedDate === attendance.date && selectedDate < calendarToday) {
      setSelectedDate(calendarToday);
    }
  }, [attendance?.date, isEmployeeViewer, selectedDate, shiftOpen]);

  useEffect(() => {
    if (!isEmployeeViewer || !canManageLiveShift) return;
    if (!shiftOpen) {
      sleepAwayPendingRef.current = false;
      /* FUTURE: cursorAwayActiveRef.current = false; */
      return;
    }

    /* FUTURE: mouse/keyboard idle — enable when ATTENDANCE_CURSOR_IDLE_ENABLED is true
    const cursorIdleEnabled = awayPolicyRef.current.cursorIdleEnabled;
    */

    const endAway = async (cause: AwayCause) => {
      /* FUTURE: cursor idle
      if (cause === "cursor_idle" && !cursorIdleEnabled) return;
      if (cause === "cursor_idle" && !cursorAwayActiveRef.current) return;
      */
      if (cause === UNSCHEDULED_CAUSE.SLEEP && !sleepAwayPendingRef.current) return;
      if (cause !== UNSCHEDULED_CAUSE.TAB_CLOSE) {
        setAwayNotice(null);
      }
      await postActivityEvent("away_end", { awayCause: cause });
      /* FUTURE: if (cause === "cursor_idle") cursorAwayActiveRef.current = false; */
      if (cause === UNSCHEDULED_CAUSE.SLEEP) sleepAwayPendingRef.current = false;
      void refresh();
    };

    /* FUTURE: mouse/keyboard idle startAway
    const startAway = async (cause: AwayCause) => {
      if (cause === UNSCHEDULED_CAUSE.TAB_CLOSE) return;
      if (cause === "cursor_idle" && !cursorIdleEnabled) return;
      await postActivityEvent("away_start", { awayCause: cause });
      if (cause === "cursor_idle") cursorAwayActiveRef.current = true;
    };
    */

    const resumeFromAway = () => {
      /* FUTURE: cursor idle
      if (cursorIdleEnabled && cursorAwayActiveRef.current) {
        void endAway("cursor_idle");
      } else if (sleepAwayPendingRef.current) {
        void endAway(UNSCHEDULED_CAUSE.SLEEP);
      }
      */
      if (sleepAwayPendingRef.current) {
        void endAway(UNSCHEDULED_CAUSE.SLEEP);
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      lastCursorAtRef.current = Date.now();
      if (sleepAwayPendingRef.current) {
        resumeFromAway();
      }
      /* FUTURE: if (cursorAwayActiveRef.current) resumeFromAway(); */
    };

    const onPageHide = () => {
      const payload = JSON.stringify({
        event: "away_start",
        source: "browser",
        awayCause: UNSCHEDULED_CAUSE.TAB_CLOSE,
        observedAt: new Date().toISOString()
      });
      void fetch("/api/attendance/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: payload,
        keepalive: true
      });
    };

    const markCursor = () => {
      lastCursorAtRef.current = Date.now();
      if (sleepAwayPendingRef.current) {
        resumeFromAway();
      }
      /* FUTURE: if (cursorAwayActiveRef.current) resumeFromAway(); */
    };

    const cursorEvents: Array<keyof WindowEventMap> = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "click"
    ];
    for (const eventName of cursorEvents) {
      window.addEventListener(eventName, markCursor, { passive: true });
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);

    const complianceTick = window.setInterval(() => {
      const now = Date.now();
      /* FUTURE: mouse/keyboard idle compliance tick
      if (cursorIdleEnabled) {
        const cursorIdleElapsed = now - lastCursorAtRef.current;
        const cursorThreshold = awayPolicyRef.current.cursorIdleMs;
        if (cursorIdleElapsed >= cursorThreshold && !cursorAwayActiveRef.current) {
          void startAway("cursor_idle");
        } else if (cursorAwayActiveRef.current && cursorIdleElapsed >= cursorThreshold) {
          setAwayNotice({ type: "away", cause: "cursor_idle" });
          void postActivityEvent("activity");
        } else if (
          !cursorAwayActiveRef.current &&
          now - lastPingAtRef.current >= ATTENDANCE_ACTIVITY_PING_MS
        ) {
          lastPingAtRef.current = now;
          void postActivityEvent("activity");
        }
      } else if ...
      */
      if (now - lastPingAtRef.current >= ATTENDANCE_ACTIVITY_PING_MS) {
        lastPingAtRef.current = now;
        void postActivityEvent("activity");
      }
    }, 1000);

    return () => {
      for (const eventName of cursorEvents) {
        window.removeEventListener(eventName, markCursor);
      }
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
      window.clearInterval(complianceTick);
    };
  }, [
    attendance?.clockIn,
    attendance?.clockOut,
    isEmployeeViewer,
    canManageLiveShift,
    shiftOpen,
    postActivityEvent,
    refresh
  ]);

  async function action(path: string, body?: Record<string, unknown>) {
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch.post<{
        attendance?: Attendance | null;
        feedback?: { message?: string };
      }>(path, body ?? {}, { timeoutMs: 45_000 });
      if (result?.attendance) {
        setAttendance(result.attendance);
      }
      await refresh();
      if (path.includes("clock-in") || path.includes("clock-out")) {
        void loadPendingExplanations();
        void loadPunctuality();
      }
      if (result?.feedback?.message) {
        toast.success(result.feedback.message);
      } else {
        const label = path.includes("break-start")
          ? "Break started"
          : path.includes("break-end")
            ? "Break ended"
            : path.includes("clock-in") || path.includes("clock-out")
              ? "Saved"
              : "Saved";
        if (!path.includes("clock-in") && !path.includes("clock-out")) {
          toast.success(label);
        }
      }
    } catch (error) {
      if (error instanceof ApiFetchError) {
        if (error.status !== 401) setError(error.message);
        const payload = error.details as { code?: string } | null;
        if (error.status === 403 && payload?.code === "LATE_EXPLANATION_REQUIRED") {
          void loadPendingExplanations();
        }
        if (error.status === 403 && payload?.code === "EARLY_LEAVE_EXPLANATION_REQUIRED") {
          void loadPendingExplanations();
        }
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  const status = attendance?.status ?? "offline";
  const statusLabel =
    status === "active"
      ? "Active (working)"
      : status === "idle"
        ? "Inactive (unscheduled)"
      : status === "break"
        ? "On break"
        : "Offline";

  const statusDotClass =
    status === "active"
      ? "bg-emerald-500"
      : status === "idle"
        ? "bg-rose-500"
      : status === "break"
        ? "bg-amber-500"
        : "bg-slate-300 dark:bg-slate-600";

  const workMinutesDisplay =
    attendance?.liveWorkMinutes != null
      ? formatWorkDuration(attendance.liveWorkMinutes)
      : formatWorkDuration(attendance?.totalWorkMinutes);

  const breaks = isMultiDayRange ? rangeBreakSessions : (attendance?.breakSessions ?? []);
  const breaksSorted = useMemo(
    () =>
      [...breaks].sort(
        (a, b) =>
          new Date(b.breakStart ?? 0).getTime() - new Date(a.breakStart ?? 0).getTime()
      ),
    [breaks]
  );
  const breakTotalPages =
    breaksSorted.length === 0 ? 0 : Math.ceil(breaksSorted.length / breakLimit);
  const paginatedBreaks = useMemo(() => {
    const start = (breakPage - 1) * breakLimit;
    return breaksSorted.slice(start, start + breakLimit);
  }, [breaksSorted, breakPage, breakLimit]);

  useEffect(() => {
    if (breakTotalPages > 0 && breakPage > breakTotalPages) {
      setBreakPage(breakTotalPages);
    }
  }, [breakPage, breakTotalPages]);

  const clockInLabel = formatAttendanceClock(attendance?.clockIn);
  const clockOutLabel = formatAttendanceClock(attendance?.clockOut);

  const breakMinutesDisplay =
    shiftOpen && attendance?.liveBreakMinutes != null
      ? formatWorkDuration(attendance.liveBreakMinutes)
      : formatWorkDuration(attendance?.totalBreakMinutes);

  const canEditShift = canManageLiveShift && !isWeekendToday;
  const canClockIn =
    canEditShift &&
    !pendingLateExplanation &&
    !pendingEarlyLeaveExplanation &&
    !pendingAbsenceExplanation &&
    (!attendance || !attendance.clockIn || Boolean(attendance.clockOut));
  const canClockOut = canEditShift && shiftOpen;
  const openBreakSession = attendance?.breakSessions?.find((session) => !session.breakEnd);
  const isManualBreakOpen = openBreakSession?.breakType === "manual";

  const canStartBreak = canManageLiveShift && shiftOpen && status === "active";
  const canEndBreak = canManageLiveShift && status === "break";

  async function prepareInstallCommand() {
    try {
      const health = await refreshAgentHealth();
      if (health?.state === "running") {
        setInstallCommand("");
        setError(null);
        toast.success("Agent is already running — no reinstall needed.");
        return;
      }

      try {
        await apiFetch("/api/attendance/desktop-agent/setup-token", { method: "POST" });
      } catch {
        // Non-blocking; verify still relies on heartbeat when agent is healthy.
      }

      let email = employeeEmail;
      if (!email) {
        const me = await apiFetch<{
          user: { email?: string | null } | null;
        }>("/api/auth/me");
        email = me.user?.email?.trim() || "";
        setEmployeeEmail(email);
      }
      if (!email) {
        toast.error("Could not read your account email. Please log in again.");
        return;
      }

      const browserOrigin =
        typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
      const baseUrl = agentHealth?.appUrl || browserOrigin;
      const exeCheck = await fetch(`${baseUrl}/desktop-agent/AttendanceAgent.exe`, {
        method: "GET",
        credentials: "include"
      });
      if (!exeCheck.ok) {
        setInstallerReady(false);
        toast.error(
          "Desktop agent file is not ready on server. Please contact admin/IT to publish AttendanceAgent.exe."
        );
        return;
      }
      setInstallerReady(true);
      const escapedBaseUrl = baseUrl.replaceAll("'", "''");
      const escapedEmail = email.replaceAll("'", "''");
      const escapedExeUrl = `${baseUrl}/desktop-agent/AttendanceAgent.exe`.replaceAll(
        "'",
        "''"
      );
      const command = [
        "Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force",
        "$ErrorActionPreference = 'Stop'",
        `$url = '${escapedBaseUrl}/desktop-agent/one-click-setup.ps1'`,
        "$local = Join-Path $env:TEMP 'asba-one-click-setup.ps1'",
        "Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $local",
        `$pwd = Read-Host 'CRM password (same as login)' -AsSecureString`,
        "$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($pwd)",
        "$plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)",
        `[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)`,
        `& $local -BaseUrl '${escapedBaseUrl}' -AgentExeUrl '${escapedExeUrl}' -Email '${escapedEmail}' -Password $plain`,
        "$plain = $null"
      ].join("\r\n");
      setInstallCommand(command);
      setShowInstallGuide(true);
      await navigator.clipboard.writeText(command);
      const isReconfigure =
        health?.state === "stale" || health?.state === "installed";
      toast.success(
        isReconfigure
          ? "Command ready below and copied. Paste in PowerShell (Admin), enter CRM password, then Verify Agent."
          : "Command ready below and copied. Paste in PowerShell (Admin), enter CRM password, then Verify Agent."
      );
    } catch (err) {
      if (err instanceof ApiFetchError) {
        toast.error(err.message || "Could not prepare installer.");
      } else {
        toast.error("Could not prepare installer.");
      }
    }
  }

  function startBreakAction() {
    setStartBreakError(null);
    setShowStartBreakModal(true);
  }

  async function submitStartBreak(payload: { category: string; note?: string }) {
    setStartBreakSubmitting(true);
    setStartBreakError(null);
    try {
      await apiFetch.post("/api/attendance/break-start", {
        category: payload.category,
        ...(payload.note ? { note: payload.note } : {})
      });
      setShowStartBreakModal(false);
      await refresh();
      toast.success("Break started");
    } catch (error) {
      setStartBreakError(
        error instanceof ApiFetchError ? error.message : "Could not start break."
      );
    } finally {
      setStartBreakSubmitting(false);
    }
  }

  function endBreakAction() {
    void action("/api/attendance/break-end");
    /* FUTURE: end-break popup — note collected at start only
    if (isManualBreakOpen) {
      setEndBreakError(null);
      setShowEndBreakModal(true);
      return;
    }
    void action("/api/attendance/break-end");
    */
  }

  /* FUTURE: end-break popup submit — kept when End break modal is re-enabled
  async function submitEndBreak(endNote: string) {
    setEndBreakSubmitting(true);
    setEndBreakError(null);
    try {
      await apiFetch.post("/api/attendance/break-end", { endNote });
      setShowEndBreakModal(false);
      await refresh();
      toast.success("Break ended");
    } catch (error) {
      setEndBreakError(
        error instanceof ApiFetchError ? error.message : "Could not end break."
      );
    } finally {
      setEndBreakSubmitting(false);
    }
  }
  */

  async function submitExtraBreak() {
    if (!ATTENDANCE_EXTRA_BREAK_ENABLED) return;
    if (!extraBreakReason.trim()) {
      toast.error("Reason is required.");
      return;
    }
    await action("/api/attendance/break-start", {
      reason: extraBreakReason.trim(),
      note: ""
    });
    setShowExtraBreakModal(false);
    setExtraBreakReason("");
  }

  async function startClockInAction() {
    if (!canClockIn) return;

    const refreshed = await refreshAgentHealth({ silent: true });
    const health = refreshed ?? agentHealthRef.current;
    if (!health) {
      toast.error("Agent status check failed. Please click Verify Agent.");
      return;
    }

    if (health.state === "not_installed") {
      setError(
        "Agent setup required. First click Install Agent, copy command, run in PowerShell (Admin), then click Verify Agent."
      );
      toast.error("Please install agent first, then verify.");
      return;
    }

    await action("/api/attendance/clock-in");
  }

  if (!profileReady) {
    return (
      <div className="space-y-5">
        <div>
          <div className="glass-chip mb-3 inline-flex text-sky-700 dark:text-sky-200">
            Time & attendance
          </div>
          <h1 className="page-title">Attendance</h1>
          <p className="page-subtitle max-w-3xl">Loading your attendance workspace…</p>
        </div>
        <div className="data-card p-6 text-base text-slate-500 dark:text-slate-400">
          Preparing clock-in controls and live status…
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="glass-chip mb-3 inline-flex text-sky-700 dark:text-sky-200">
          Time & attendance
        </div>
        <h1 className="page-title">Attendance</h1>
        <p className="page-subtitle max-w-3xl">
          {isEmployeeViewer
            ? "Clock in, track breaks, and view today's summary. Refreshes every 20 seconds."
            : "Tracks working hours, breaks, and live status (refreshes every 20 seconds while this page is open)."}
        </p>
        {isEmployeeViewer ? (
          <p className="mt-2 max-w-3xl text-base text-slate-600 dark:text-slate-400">
            You can open other websites or browser tabs while you work. Only closing
            this Attendance tab is reported to your manager.
          </p>
        ) : null}
        {!isEmployeeViewer ? (
          <ul className="mt-3 max-w-3xl space-y-1 text-base text-slate-500 dark:text-slate-400">
            <li>Working hours: clock in/out and net work time (minus breaks)</li>
            <li>Breaks: start/end break sessions with running totals</li>
            <li>Live status: Active, Inactive, Break, or Offline</li>
          </ul>
        ) : null}
      </div>

      {isEmployeeViewer && isWeekendToday ? (
        <div className="flex gap-3 rounded-2xl border border-slate-200/90 bg-slate-50/80 px-4 py-3 shadow-sm dark:border-slate-700/80 dark:bg-slate-900/40">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            <Info className="h-4 w-4" aria-hidden />
          </div>
          <div className="min-w-0 text-base text-slate-700 dark:text-slate-300">
            <p className="font-semibold text-slate-900 dark:text-slate-100">Weekend off</p>
            <p className="mt-1 text-base leading-relaxed text-slate-600 dark:text-slate-400">
              {ATTENDANCE_WEEKEND_OFF_MESSAGE} Review past days below; clock-in resumes Monday.
            </p>
          </div>
        </div>
      ) : null}

      {isEmployeeViewer && lateExplanationTestMode ? (
        <div className="flex gap-3 rounded-2xl border border-sky-200/90 bg-gradient-to-r from-sky-50/90 via-white to-white px-4 py-4 shadow-sm dark:border-sky-800/60 dark:from-sky-950/25 dark:via-slate-950 dark:to-slate-950">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sky-200/80 bg-white text-sky-600 dark:border-sky-800/70 dark:bg-sky-950/50 dark:text-sky-300">
            <Info className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-base font-semibold leading-snug text-sky-800 dark:text-sky-200">
              Testing note — not a notification
            </p>
            <p className="mt-2 text-base leading-relaxed text-slate-700 dark:text-slate-300">
              Late / early / absence <strong className="font-semibold text-slate-900 dark:text-slate-100">reason popups</strong> show{" "}
              <strong className="font-semibold text-slate-900 dark:text-slate-100">today</strong> while you test. On the live site
              they appear the <strong className="font-semibold text-slate-900 dark:text-slate-100">next working day</strong> (weekends
              off).
            </p>
          </div>
        </div>
      ) : null}

      {isEmployeeViewer ? (
        <AttendancePunctualityCard stats={punctualityStats} loading={punctualityLoading} />
      ) : null}

      {pendingLateExplanation ? (
        <AttendanceLateExplanationModal
          pending={pendingLateExplanation}
          submitting={lateExplanationSubmitting}
          error={lateExplanationError}
          onSubmit={(reason) => void submitLateExplanation(reason)}
        />
      ) : pendingEarlyLeaveExplanation ? (
        <AttendanceEarlyLeaveExplanationModal
          pending={pendingEarlyLeaveExplanation}
          submitting={earlyLeaveExplanationSubmitting}
          error={earlyLeaveExplanationError}
          onSubmit={(reason) => void submitEarlyLeaveExplanation(reason)}
        />
      ) : pendingAbsenceExplanation ? (
        <AttendanceAbsenceExplanationModal
          pending={pendingAbsenceExplanation}
          submitting={absenceExplanationSubmitting}
          error={absenceExplanationError}
          onSubmit={(reason) => void submitAbsenceExplanation(reason)}
        />
      ) : null}

      {awayNotice && isEmployeeViewer ? (
        awayNotice.type === "tab_returned" ? (
          <AttendanceTabCloseReturnedNotice
            closedAt={awayNotice.closedAt}
            awaySeconds={awayNotice.awaySeconds}
          />
        ) : awayNotice.cause === UNSCHEDULED_CAUSE.SLEEP ? (
          <AttendanceAwayNotice cause={awayNotice.cause} />
        ) : null
      ) : null}

      {showStartBreakModal ? (
        <AttendanceStartBreakModal
          submitting={startBreakSubmitting}
          error={startBreakError}
          onCancel={() => {
            if (!startBreakSubmitting) setShowStartBreakModal(false);
          }}
          onSubmit={(payload) => void submitStartBreak(payload)}
        />
      ) : null}

      {/* FUTURE: end-break popup — employee note is collected at Start break only
      {showEndBreakModal && isManualBreakOpen ? (
        <AttendanceEndBreakModal
          breakStart={openBreakSession?.breakStart ?? null}
          breakCategory={openBreakSession?.breakCategory ?? null}
          startNote={openBreakSession?.startNote ?? null}
          submitting={endBreakSubmitting}
          error={endBreakError}
          onSubmit={(endNote) => void submitEndBreak(endNote)}
        />
      ) : null}
      */}

      {ATTENDANCE_EXTRA_BREAK_ENABLED && showExtraBreakModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/45 backdrop-blur-[1px]"
            aria-label="Close extra break dialog"
            onClick={() => setShowExtraBreakModal(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900"
          >
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Extra Break Reason
            </h3>
            <p className="mt-1 text-base text-slate-600 dark:text-slate-300">
              Official break already used. Please write reason for extra break.
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-base font-medium uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                  Reason
                </label>
                <input
                  value={extraBreakReason}
                  onChange={(e) => setExtraBreakReason(e.target.value)}
                  placeholder="e.g. personal call, urgent task, client discussion"
                  className="form-input mt-1 min-h-[2.75rem] w-full py-2 leading-5"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setShowExtraBreakModal(false)}
              >
                Cancel
              </Button>
              <Button type="button" size="sm" onClick={() => void submitExtraBreak()}>
                Start extra break
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/35 dark:text-red-300">
          {error}
        </div>
      )}
      {isEmployeeViewer ? (
        <div className="data-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="text-sm font-semibold uppercase tracking-[0.12em] text-sky-700 dark:text-sky-300">
                Background monitoring setup
              </div>
              <p className="text-base font-medium leading-relaxed text-slate-900 dark:text-slate-100">
                Install the desktop agent once per laptop. It auto-refreshes login — no daily
                reinstall.
              </p>
              {installerReady !== null ? (
                <p
                  className={`text-sm font-semibold ${
                    installerReady
                      ? "text-emerald-700 dark:text-emerald-300"
                      : "text-rose-700 dark:text-rose-300"
                  }`}
                >
                  {installerReady ? "Agent installer ready" : "Agent installer missing"}
                </p>
              ) : null}
              <p className="text-base leading-relaxed text-slate-700 dark:text-slate-300">
                {agentStateHintForDisplay(agentHealth?.state ?? "not_installed")}
              </p>
              {agentHealth?.lastActivitySource ? (
                <p className="text-base leading-relaxed text-slate-600 dark:text-slate-400">
                  Last signal source:{" "}
                  <strong className="font-semibold text-slate-800 dark:text-slate-200">
                    {agentHealth.lastActivitySource}
                  </strong>
                </p>
              ) : null}
            </div>
            <span
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold uppercase ${employeeAgentBadgeClass(
                agentHealth?.state ?? "not_installed"
              )}`}
            >
              {agentHealth?.statusLabel ?? labelForDisplayAgentState(agentHealth?.state ?? "not_installed")}
            </span>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => void prepareInstallCommand()}
            >
              {agentHealth?.state === "stale" || agentHealth?.state === "installed"
                ? "Reconfigure Agent"
                : "Install Agent"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={agentLoading}
              onClick={() => void verifyAgentNow()}
            >
              {agentLoading
                ? "Verifying..."
                : verifyRetryInSeconds > 0
                  ? `Retry in ${verifyRetryInSeconds}s`
                  : "Verify Agent"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowInstallGuide((v) => !v)}
            >
              Install Guide
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const diagnosticsCommand = [
                  "Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force",
                  "Set-Location \"C:\\ProgramData\\AsbaTechs\\AttendanceAgent\\setup\"",
                  ".\\verify-agent.ps1"
                ].join("\r\n");
                void navigator.clipboard.writeText(diagnosticsCommand);
                toast.success("Agent check command copied.");
              }}
            >
              Check Agent
            </Button>
          </div>

          {agentError ? (
            <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/35 dark:text-red-300">
              {agentError}
            </p>
          ) : null}

          {showInstallGuide ? (
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-900/40">
              <p className="text-sm font-semibold uppercase text-slate-500 dark:text-slate-400">
                Install guide (one-time per laptop)
              </p>
              <ol className="mt-2 list-decimal space-y-1 pl-4 text-base text-slate-700 dark:text-slate-300">
                <li>Click <strong>Install Agent</strong> (or <strong>Reconfigure Agent</strong> if broken).</li>
                <li>Paste the command in <strong>PowerShell as Administrator</strong>.</li>
                <li>Enter your <strong>CRM password</strong> when asked (same as login).</li>
                <li>Click <strong>Verify Agent</strong> — should show <strong>Running</strong>.</li>
              </ol>
            </div>
          ) : null}
          {installCommand ? (
            <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50/80 p-3 dark:border-sky-900/50 dark:bg-sky-950/25">
              <p className="text-sm font-semibold uppercase text-sky-700 dark:text-sky-300">
                One-click install command
              </p>
              <p className="mt-1 text-base text-slate-700 dark:text-slate-300">
                Copied to clipboard. Paste in <strong>PowerShell (Run as Administrator)</strong>,
                press Enter, then type your CRM password when prompted.
              </p>
              <textarea
                readOnly
                value={installCommand}
                className="form-input mt-2 min-h-[5.5rem] w-full resize-y py-2 text-sm leading-5"
              />
              <div className="mt-2 flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    void navigator.clipboard.writeText(installCommand);
                    toast.success("Command copied.");
                  }}
                >
                  Copy Command
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
      {isEmployeeViewer ? (
      <>
      {!isViewingToday && !canManageLiveShift ? (
        <p className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/35 dark:text-sky-300">
          Viewing {selectedDate}. Clock in, breaks, and live timers apply only to today — use
          Today or pick today in the calendar for active actions.
        </p>
      ) : null}
      {attendance?.carriedOvernight ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-200">
          Your overnight shift from <strong>{attendance.date}</strong> is still open. Clock out
          when you finish — it will save against that shift date.
        </p>
      ) : null}
      {isMultiDayRange ? (
        <p className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/35 dark:text-sky-300">
          Summary below is for <strong>{selectedDate}</strong>. Breaks list shows all sessions
          from {dateFrom} to {dateTo}
          {rangeBreaksLoading ? " (loadingâ€¦)" : ""}.
        </p>
      ) : null}
      <div className="grid gap-6 xl:grid-cols-2 xl:items-stretch">
        <div className="data-card flex min-h-[22rem] flex-col p-4">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="text-sm font-semibold uppercase tracking-[0.12em] text-sky-700 dark:text-sky-300">
                Live status
              </div>
              <div className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-full ${statusDotClass}`}
                  title={statusLabel}
                />
                {statusLabel}
              </div>
              <p className="text-base leading-relaxed text-slate-700 dark:text-slate-300">
                {formatAttendanceRangeLabel(dateFrom, dateTo)}
                {isMultiDayRange ? (
                  <span className="text-slate-600 dark:text-slate-400">
                    {" "}
                    · viewing <strong className="font-semibold">{selectedDate}</strong>
                  </span>
                ) : null}
              </p>
              {lastUpdated && (
                <p className="text-base text-slate-600 dark:text-slate-400">
                  Updated {formatAttendanceClock(lastUpdated)}
                </p>
              )}
              {attendance?.clockOut && (
                <p className="mt-2 max-w-[16rem] text-base leading-relaxed text-slate-600 dark:text-slate-400">
                  Shift ended. <strong>Clock in</strong> again to start a new
                  shift today (timer and break list reset for this entry).
                </p>
              )}
            </div>
            <div className="space-x-2">
              <Button
                size="sm"
                variant={canClockIn && !loading ? "default" : "outline"}
                disabled={loading || !canClockIn}
                title={
                  pendingLateExplanation || pendingEarlyLeaveExplanation
                    ? "Submit your pending attendance explanation before clocking in."
                    : !canClockIn
                      ? "You are already clocked in. Clock out to start a new shift later."
                      : attendance?.clockOut
                        ? "Start a new shift today (previous totals were saved)."
                        : undefined
                }
                onClick={() => void startClockInAction()}
              >
                Clock in
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={loading || !canClockOut}
                title={
                  !canClockOut
                    ? "Clock in first, while your shift is open."
                    : undefined
                }
                onClick={() => action("/api/attendance/clock-out")}
              >
                Clock out
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={loading || !canStartBreak}
              title={
                !canStartBreak
                  ? shiftOpen
                    ? status === "idle"
                      ? "Return to active status first; inactive time is auto-classified."
                      : "End your current break before starting another."
                    : "Clock in to start a break."
                  : undefined
              }
              onClick={() => void startBreakAction()}
            >
              Start break
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={loading || !canEndBreak}
              title={
                !canEndBreak ? "Start a break first." : undefined
              }
              onClick={() => void endBreakAction()}
            >
              End break
            </Button>
          </div>
          <div className="mt-4">
            <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Today&apos;s summary
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <AttendanceStatTile label="Clock in" value={clockInLabel} />
              <AttendanceStatTile label="Clock out" value={clockOutLabel} />
              <AttendanceStatTile
                label="Work hours"
                value={workMinutesDisplay}
                valueClassName="text-emerald-700 dark:text-emerald-300"
              />
              <AttendanceStatTile
                label="Break minutes"
                value={breakMinutesDisplay}
                valueClassName="text-amber-700 dark:text-amber-300"
                hint={BREAK_MINUTES_HINT}
              />
            </div>
          </div>
        </div>
        <div className="data-card flex min-h-[22rem] flex-col p-4">
          <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2">
            <div className="text-base font-medium text-slate-900 dark:text-slate-100">Breaks</div>
            {breaks.length > 0 ? (
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-sm font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {breaks.length} {breaks.length === 1 ? "session" : "sessions"}
              </span>
            ) : null}
          </div>
          <div className="mb-4 shrink-0">
            <AttendanceDateRangeCalendar
              variant="compact"
              autoApply
              from={dateFrom}
              to={dateTo}
              activeDate={selectedDate}
              onRangeChange={(from, to) => {
                setDateFrom(from);
                setDateTo(to);
                setSelectedDate(to);
                setBreakPage(1);
              }}
              onActiveDateChange={(iso) => {
                setSelectedDate(iso);
                setBreakPage(1);
              }}
            />
          </div>
          {rangeBreaksLoading && isMultiDayRange ? (
            <p className="text-base text-slate-500 dark:text-slate-400">
              Loading break sessions for the selected rangeâ€¦
            </p>
          ) : breaks.length === 0 ? (
            <p className="text-base text-slate-500 dark:text-slate-400">
              {isMultiDayRange
                ? "No break sessions in this date range."
                : "No break sessions for this date."}
            </p>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="max-h-[min(28rem,60vh)] overflow-x-auto overflow-y-auto rounded-xl border border-slate-200/90 bg-slate-50/50 dark:border-slate-700/90 dark:bg-slate-950/30">
                <table className="w-full min-w-[22rem] border-collapse text-sm">
                  <thead className="sticky top-0 z-[1] bg-slate-50/95 backdrop-blur-sm dark:bg-slate-950/95">
                    <tr className="border-b border-slate-200/80 text-left uppercase text-slate-500 dark:border-slate-700/80 dark:text-slate-400">
                      {isMultiDayRange ? (
                        <th className="whitespace-nowrap px-2.5 py-2">Date</th>
                      ) : null}
                      <th className="whitespace-nowrap px-2.5 py-2">Start</th>
                      <th className="whitespace-nowrap px-2.5 py-2">End</th>
                      <th className="whitespace-nowrap px-2.5 py-2">Dur.</th>
                      <th className="min-w-[9rem] px-2.5 py-2">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedBreaks.map((b) => {
                    const start = formatAttendanceClock(b.breakStart);
                    const end = b.breakEnd ? formatAttendanceClock(b.breakEnd) : "Open";
                    let duration = "â€”";
                    if (b.breakStart && b.breakEnd) {
                      const mins = Math.round(
                        (new Date(b.breakEnd).getTime() -
                          new Date(b.breakStart).getTime()) /
                          60000
                      );
                      duration = `${mins} min`;
                    } else if (b.breakStart && !b.breakEnd) {
                      const mins = Math.round(
                        (Date.now() - new Date(b.breakStart).getTime()) / 60000
                      );
                      duration = `~${mins}m Â· open`;
                    }
                    const reason = breakSessionReasonLabel(b);
                    const dateLabel = b.logDate ? formatAttendanceDateLabel(b.logDate) : "-";
                    return (
                      <tr
                        key={`${b.logDate ?? "day"}-${b.id}`}
                        className="border-b border-slate-100/90 last:border-b-0 dark:border-slate-800/90"
                      >
                        {isMultiDayRange ? (
                          <td className="whitespace-nowrap px-2.5 py-2.5 align-top text-slate-600 dark:text-slate-300">
                            {dateLabel}
                          </td>
                        ) : null}
                        <td className="whitespace-nowrap px-2.5 py-2.5 align-top text-slate-700 dark:text-slate-200">
                          {start}
                        </td>
                        <td className="whitespace-nowrap px-2.5 py-2.5 align-top text-slate-700 dark:text-slate-200">
                          {end}
                        </td>
                        <td className="whitespace-nowrap px-2.5 py-2.5 align-top font-medium tabular-nums text-slate-600 dark:text-slate-300">
                          {duration}
                        </td>
                        <td
                          className="min-w-[9rem] max-w-[12rem] px-2.5 py-2.5 align-top text-slate-700 dark:text-slate-200 sm:max-w-none"
                          title={reason}
                        >
                          <span className="block break-words leading-snug">{reason}</span>
                        </td>
                      </tr>
                    );
                  })}
                  </tbody>
                </table>
              </div>
              <TablePagination
                className="mt-3 shrink-0 border-t-0 pt-0"
                page={breakPage}
                totalPages={breakTotalPages}
                total={breaksSorted.length}
                limit={breakLimit}
                onPageChange={setBreakPage}
                onLimitChange={(n) => {
                  setBreakLimit(n);
                  setBreakPage(1);
                }}
                limitOptions={[5, 10, 15, 25]}
              />
            </div>
          )}
        </div>
      </div>
      </>
      ) : (
        <section className="data-card p-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Monitoring only
          </h2>
          <p className="mt-2 text-base text-slate-600 dark:text-slate-300">
            Admin and manager accounts do not mark attendance. Use Executive Dashboard to monitor employee status, inactive events, and timelines.
          </p>
        </section>
      )}
    </div>
  );
}
