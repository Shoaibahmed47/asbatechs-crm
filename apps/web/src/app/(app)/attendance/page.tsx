"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, HelpCircle, Laptop, MousePointer2, PanelTop } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AttendanceDateRangeCalendar,
  formatAttendanceRangeLabel
} from "@/components/attendance/AttendanceDateRangeCalendar";
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
import { UNSCHEDULED_CAUSE } from "@/lib/attendance-reason";

type AttendanceStatus = "active" | "break" | "idle" | "offline";

type BreakSessionRow = {
  id: number;
  breakStart: string | null;
  breakEnd: string | null;
  breakType?: string | null;
  unscheduledCause?: string | null;
  returnReason?: string | null;
  logDate?: string;
};

type Attendance = {
  id: number;
  date: string;
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
};

type AwayNoticeState =
  | { type: "away"; cause: AwayCause }
  | { type: "tab_returned"; closedAt: string; awaySeconds: number };

/** On-page away prompts (cursor idle / sleep). Tab close uses TAB_CLOSE_RETURNED_NOTICE. */
const AWAY_EMPLOYEE_NOTICE: Record<
  typeof UNSCHEDULED_CAUSE.CURSOR_IDLE | typeof UNSCHEDULED_CAUSE.SLEEP,
  string
> = {
  [UNSCHEDULED_CAUSE.CURSOR_IDLE]:
    "No mouse or keyboard activity was detected. Move your cursor or click anywhere to continue.",
  [UNSCHEDULED_CAUSE.SLEEP]:
    "Your laptop was locked or went to sleep. Wake your laptop, then move your mouse or click anywhere to continue."
};

const AWAY_NOTICE_META: Record<
  typeof UNSCHEDULED_CAUSE.CURSOR_IDLE | typeof UNSCHEDULED_CAUSE.SLEEP,
  { label: string; icon: typeof MousePointer2 | typeof Laptop }
> = {
  [UNSCHEDULED_CAUSE.CURSOR_IDLE]: { label: "Inactivity", icon: MousePointer2 },
  [UNSCHEDULED_CAUSE.SLEEP]: { label: "Sleep / lock", icon: Laptop }
};

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
      className="data-card overflow-hidden p-0"
    >
      <div className="flex items-stretch gap-0 border-l-4 border-amber-500 dark:border-amber-400">
        <div className="flex flex-1 flex-col gap-3 p-4 sm:flex-row sm:items-start sm:gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-200/90 bg-gradient-to-br from-white to-amber-50/90 text-amber-600 shadow-sm dark:border-amber-800/80 dark:from-slate-900 dark:to-amber-950/50 dark:text-amber-300">
            <PanelTop className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="glass-chip inline-flex text-amber-800 dark:text-amber-200">
                Attendance tab reopened
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200/90 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-400">
                <AlertCircle className="h-3 w-3" aria-hidden />
                Shared with admin
              </span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-slate-800 dark:text-slate-200">
              You closed the Attendance browser tab at {closedLabel}. Your manager was
              notified. You were away for {durationLabel}. Switching to other websites or
              tabs is fine — please keep this Attendance tab open while you are clocked in.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function AttendanceAwayNotice({
  cause
}: {
  cause: typeof UNSCHEDULED_CAUSE.CURSOR_IDLE | typeof UNSCHEDULED_CAUSE.SLEEP;
}) {
  const meta = AWAY_NOTICE_META[cause];
  const Icon = meta.icon;

  return (
    <div
      role="status"
      aria-live="polite"
      className="data-card overflow-hidden p-0"
    >
      <div className="flex items-stretch gap-0 border-l-4 border-sky-500 dark:border-sky-400">
        <div className="flex flex-1 flex-col gap-3 p-4 sm:flex-row sm:items-start sm:gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sky-200/90 bg-gradient-to-br from-white to-sky-50/90 text-sky-600 shadow-sm dark:border-sky-800/80 dark:from-slate-900 dark:to-sky-950/50 dark:text-sky-300">
            <Icon className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="glass-chip inline-flex text-sky-700 dark:text-sky-200">
                {meta.label}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200/90 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-400">
                <AlertCircle className="h-3 w-3" aria-hidden />
                Admin notified
              </span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-slate-800 dark:text-slate-200">
              {AWAY_EMPLOYEE_NOTICE[cause]}
            </p>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Move your mouse or click anywhere to continue. No typing required.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

const BREAK_MINUTES_HINT = `Total time today when you were not counted as working while clocked in. Includes official breaks, extra breaks, and auto-detected away time (no mouse/keyboard, closing this Attendance tab, or laptop sleep) once each lasts about ${ATTENDANCE_AWAY_POLICY.cursorIdleAwaySeconds} seconds or longer. Switching to other browser tabs or sites does not count. Work hours = time since clock in minus break minutes.`;

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
      <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
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
          className="absolute left-0 top-full z-30 mt-1.5 w-[min(18rem,calc(100vw-2rem))] rounded-lg border border-slate-200/90 bg-white p-2.5 text-[11px] normal-case leading-relaxed tracking-normal text-slate-600 shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
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

function statusBadgeClass(state: AgentHealthState): string {
  if (state === "running") return "bg-emerald-100 text-emerald-800";
  if (state === "installed") return "bg-sky-100 text-sky-800";
  if (state === "stale") return "bg-amber-100 text-amber-800";
  return "bg-slate-200 text-slate-700";
}

function agentStateHint(state: AgentHealthState): string {
  if (state === "running") return "Live monitoring is active.";
  if (state === "installed") return "Setup done, waiting for fresh signal.";
  if (state === "stale") return "No recent activity signal from agent.";
  return "Agent not verified yet.";
}

export default function AttendancePage() {
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
  const [viewerRole, setViewerRole] = useState<ViewerRole>("");
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
  const [awayNotice, setAwayNotice] = useState<AwayNoticeState | null>(null);

  const lastPingAtRef = useRef<number>(0);
  const sleepAwayPendingRef = useRef(false);
  const awayPolicyRef = useRef({
    tabCloseMs: 10_000,
    cursorIdleMs: 10_000,
    laptopSleepMs: 10_000
  });
  const cursorAwayActiveRef = useRef(false);
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
          laptopSleepMs: policy.away.laptopSleepAwaySeconds * 1000
        };
      })
      .catch(() => {
        // Defaults from awayPolicyRef already match server policy file.
      });
  }, []);

  const refreshAgentHealth = useCallback(async (): Promise<AgentHealth | null> => {
    setAgentError(null);
    setAgentLoading(true);
    try {
      const status = await apiFetch<AgentHealth>("/api/attendance/desktop-agent/status", {
        timeoutMs: 30_000
      });
      setAgentHealth(status);
      return status;
    } catch (error) {
      if (error instanceof ApiFetchError && error.status !== 401) {
        setAgentError(error.message || "Unable to verify desktop agent.");
      } else if (!(error instanceof ApiFetchError)) {
        setAgentError("Unable to verify desktop agent.");
      }
      return null;
    } finally {
      setAgentLoading(false);
    }
  }, []);

  const verifyAgentNow = useCallback(async () => {
    const status = await refreshAgentHealth();
    if (!status) {
      setVerifyRetryInSeconds(10);
      toast.error("Verify is slow or timed out. Will retry — you can also Clock in if status is Installed.");
      return;
    }
    setVerifyRetryInSeconds(0);
    setAgentError(null);
    toast.success(`Agent status: ${status.statusLabel}`);
  }, [refreshAgentHealth]);

  const refreshMyProfile = useCallback(async () => {
    try {
      const me = await apiFetch<{
        user: { email?: string | null; role?: ViewerRole | null } | null;
      }>(
        "/api/auth/me"
      );
      setViewerRole(me.user?.role?.trim() || "");
      setEmployeeEmail(me.user?.email?.trim() || "");
    } catch {
      // Non-blocking.
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

  const isEmployeeViewer = viewerRole === "employee";
  const shouldRedirectToReport = viewerRole === "admin" || viewerRole === "manager";
  const isViewingToday = selectedDate === getLocalDateString();
  const isMultiDayRange = dateFrom !== dateTo;

  useEffect(() => {
    if (!isEmployeeViewer || !attendance?.breakSessions) return;
    const openAway = attendance.breakSessions.find(
      (session) =>
        !session.breakEnd &&
        (session.unscheduledCause === "cursor_idle" ||
          session.unscheduledCause === "sleep")
    );
    if (!openAway?.unscheduledCause) {
      sleepAwayPendingRef.current = false;
      return;
    }
    const cause = openAway.unscheduledCause as AwayCause;
    if (cause === UNSCHEDULED_CAUSE.SLEEP) {
      sleepAwayPendingRef.current = true;
    }
    if (
      cause === UNSCHEDULED_CAUSE.CURSOR_IDLE ||
      cause === UNSCHEDULED_CAUSE.SLEEP
    ) {
      setAwayNotice({ type: "away", cause });
    }
  }, [attendance?.breakSessions, isEmployeeViewer]);

  useEffect(() => {
    if (!isEmployeeViewer || !isViewingToday) return;
    const shiftOpen = Boolean(attendance?.clockIn && !attendance?.clockOut);
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
    isViewingToday,
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
    void refreshAgentHealth();
    void refreshMyProfile();
  }, [refresh, refreshAgentHealth, refreshMyProfile, isEmployeeViewer]);

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
    if (verifyRetryInSeconds !== 0) return;
    if (agentLoading) return;
    if (!agentError) return;
    void verifyAgentNow();
  }, [verifyRetryInSeconds, agentLoading, agentError, verifyAgentNow]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (isViewingToday) {
        void refresh();
      }
      void refreshAgentHealth();
    }, 20000);
    return () => window.clearInterval(id);
  }, [isViewingToday, refresh, refreshAgentHealth]);

  useEffect(() => {
    if (!isEmployeeViewer || !isViewingToday) return;
    const shiftOpen = Boolean(attendance?.clockIn && !attendance?.clockOut);
    if (!shiftOpen) {
      cursorAwayActiveRef.current = false;
      sleepAwayPendingRef.current = false;
      return;
    }

    const endAway = async (cause: AwayCause) => {
      if (cause === "cursor_idle" && !cursorAwayActiveRef.current) return;
      if (cause === UNSCHEDULED_CAUSE.SLEEP && !sleepAwayPendingRef.current) return;
      if (cause !== UNSCHEDULED_CAUSE.TAB_CLOSE) {
        setAwayNotice(null);
      }
      await postActivityEvent("away_end", { awayCause: cause });
      if (cause === "cursor_idle") cursorAwayActiveRef.current = false;
      if (cause === UNSCHEDULED_CAUSE.SLEEP) sleepAwayPendingRef.current = false;
      void refresh();
    };

    const startAway = async (cause: AwayCause) => {
      if (cause === UNSCHEDULED_CAUSE.TAB_CLOSE) return;
      await postActivityEvent("away_start", { awayCause: cause });
      if (cause === "cursor_idle") cursorAwayActiveRef.current = true;
    };

    const resumeFromAway = () => {
      if (cursorAwayActiveRef.current) {
        void endAway("cursor_idle");
      } else if (sleepAwayPendingRef.current) {
        void endAway(UNSCHEDULED_CAUSE.SLEEP);
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      lastCursorAtRef.current = Date.now();
      if (cursorAwayActiveRef.current || sleepAwayPendingRef.current) {
        resumeFromAway();
      }
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
      if (cursorAwayActiveRef.current || sleepAwayPendingRef.current) {
        resumeFromAway();
      }
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
    isViewingToday,
    postActivityEvent,
    refresh
  ]);

  async function action(path: string, body?: Record<string, unknown>) {
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch.post<{ attendance?: Attendance | null }>(
        path,
        body ?? {},
        { timeoutMs: 45_000 }
      );
      if (result?.attendance) {
        setAttendance(result.attendance);
      }
      await refresh();
      const label = path.includes("clock-in")
        ? "Clocked in"
        : path.includes("clock-out")
          ? "Clocked out"
          : path.includes("break-start")
            ? "Break started"
            : path.includes("break-end")
              ? "Break ended"
              : "Saved";
      toast.success(label);
    } catch (error) {
      if (error instanceof ApiFetchError) {
        if (error.status !== 401) setError(error.message);
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
  const shiftOpen = Boolean(
    attendance?.clockIn && !attendance?.clockOut
  );

  const breakMinutesDisplay =
    shiftOpen && attendance?.liveBreakMinutes != null
      ? formatWorkDuration(attendance.liveBreakMinutes)
      : formatWorkDuration(attendance?.totalBreakMinutes);

  const canEditShift = isViewingToday;
  const canClockIn =
    canEditShift &&
    (!attendance || !attendance.clockIn || Boolean(attendance.clockOut));
  const canClockOut = canEditShift && shiftOpen;
  const canStartBreak =
    isViewingToday && shiftOpen && status === "active";
  const canEndBreak = isViewingToday && status === "break";

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

  async function startBreakAction() {
    const sessions = attendance?.breakSessions ?? [];
    const hasUsedOfficialBreak = sessions.some((session) => session.breakType === "manual");
    if (!hasUsedOfficialBreak) {
      await action("/api/attendance/break-start");
      return;
    }
    setExtraBreakReason("");
    setShowExtraBreakModal(true);
  }

  async function submitExtraBreak() {
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

    const health = await refreshAgentHealth();
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

    toast.success("Agent setup already done.");
    await action("/api/attendance/clock-in");
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
          <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-400">
            You can open other websites or browser tabs while you work. Only closing
            this Attendance tab is reported to your manager.
          </p>
        ) : null}
        {!isEmployeeViewer ? (
          <ul className="mt-3 max-w-3xl space-y-1 text-xs text-slate-500 dark:text-slate-400">
            <li>Working hours: clock in/out and net work time (minus breaks)</li>
            <li>Breaks: start/end break sessions with running totals</li>
            <li>Live status: Active, Inactive, Break, or Offline</li>
          </ul>
        ) : null}
      </div>

      {awayNotice && isEmployeeViewer ? (
        awayNotice.type === "tab_returned" ? (
          <AttendanceTabCloseReturnedNotice
            closedAt={awayNotice.closedAt}
            awaySeconds={awayNotice.awaySeconds}
          />
        ) : awayNotice.cause === UNSCHEDULED_CAUSE.CURSOR_IDLE ||
          awayNotice.cause === UNSCHEDULED_CAUSE.SLEEP ? (
          <AttendanceAwayNotice cause={awayNotice.cause} />
        ) : null
      ) : null}

      {showExtraBreakModal ? (
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
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Official break already used. Please write reason for extra break.
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
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
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/35 dark:text-red-300">
          {error}
        </div>
      )}
      {isEmployeeViewer ? (
        <div className="data-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                Background monitoring setup
              </div>
              <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
                Install the desktop agent once per laptop. It auto-refreshes login — no daily
                reinstall.
              </p>
              {installerReady !== null ? (
                <p
                  className={`mt-1 text-xs font-medium ${
                    installerReady
                      ? "text-emerald-700 dark:text-emerald-300"
                      : "text-rose-700 dark:text-rose-300"
                  }`}
                >
                  {installerReady ? "Agent installer ready" : "Agent installer missing"}
                </p>
              ) : null}
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                {agentStateHint(agentHealth?.state ?? "not_installed")}
              </p>
              {agentHealth?.lastActivitySource ? (
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Last signal source:{" "}
                  <strong>{agentHealth.lastActivitySource}</strong>
                </p>
              ) : null}
            </div>
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase ${statusBadgeClass(
                agentHealth?.state ?? "not_installed"
              )}`}
            >
              {agentHealth?.statusLabel ?? "Not installed"}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => void prepareInstallCommand()}
            >
              {agentHealth?.state === "stale" || agentHealth?.state === "installed"
                ? "Reconfigure Agent"
                : "Install Agent"}
            </Button>
            <Button
              type="button"
              size="sm"
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
              size="sm"
              variant="outline"
              onClick={() => setShowInstallGuide((v) => !v)}
            >
              Install Guide
            </Button>
            <Button
              type="button"
              size="sm"
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
            <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/35 dark:text-red-300">
              {agentError}
            </p>
          ) : null}

          {showInstallGuide ? (
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-900/40">
              <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                Install guide (one-time per laptop)
              </p>
              <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs text-slate-700 dark:text-slate-300">
                <li>Click <strong>Install Agent</strong> (or <strong>Reconfigure Agent</strong> if broken).</li>
                <li>Paste the command in <strong>PowerShell as Administrator</strong>.</li>
                <li>Enter your <strong>CRM password</strong> when asked (same as login).</li>
                <li>Click <strong>Verify Agent</strong> — should show <strong>Running</strong>.</li>
              </ol>
            </div>
          ) : null}
          {installCommand ? (
            <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50/80 p-3 dark:border-sky-900/50 dark:bg-sky-950/25">
              <p className="text-xs font-semibold uppercase text-sky-700 dark:text-sky-300">
                One-click install command
              </p>
              <p className="mt-1 text-xs text-slate-700 dark:text-slate-300">
                Copied to clipboard. Paste in <strong>PowerShell (Run as Administrator)</strong>,
                press Enter, then type your CRM password when prompted.
              </p>
              <textarea
                readOnly
                value={installCommand}
                className="form-input mt-2 min-h-[5.5rem] w-full resize-y py-2 text-xs leading-5"
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
      {!isViewingToday ? (
        <p className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/35 dark:text-sky-300">
          Viewing {selectedDate}. Clock in, breaks, and live timers apply only to today â€” use
          Today or pick today in the calendar for active actions.
        </p>
      ) : null}
      {isMultiDayRange ? (
        <p className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/35 dark:text-sky-300">
          Summary below is for <strong>{selectedDate}</strong>. Breaks list shows all sessions
          from {dateFrom} to {dateTo}
          {rangeBreaksLoading ? " (loadingâ€¦)" : ""}.
        </p>
      ) : null}
      <div className="grid gap-6 xl:grid-cols-2 xl:items-stretch">
        <div className="data-card flex min-h-[22rem] flex-col p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                Live status
              </div>
              <div className="mt-1 flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-full ${statusDotClass}`}
                  title={statusLabel}
                />
                {statusLabel}
              </div>
              <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-300">
                {formatAttendanceRangeLabel(dateFrom, dateTo)}
                {isMultiDayRange ? (
                  <span className="text-slate-500 dark:text-slate-400">
                    {" "}
                    Â· viewing <strong>{selectedDate}</strong>
                  </span>
                ) : null}
              </p>
              {lastUpdated && (
                <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">
                  Updated {formatAttendanceClock(lastUpdated)}
                </p>
              )}
              {attendance?.clockOut && (
                <p className="mt-2 max-w-[14rem] text-[11px] leading-snug text-slate-500 dark:text-slate-400">
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
                  !canClockIn
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
              onClick={() => action("/api/attendance/break-end")}
            >
              End break
            </Button>
          </div>
          <div className="mt-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
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
            <div className="text-sm font-medium text-slate-900 dark:text-slate-100">Breaks</div>
            {breaks.length > 0 ? (
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
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
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Loading break sessions for the selected rangeâ€¦
            </p>
          ) : breaks.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isMultiDayRange
                ? "No break sessions in this date range."
                : "No break sessions for this date."}
            </p>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="max-h-[min(28rem,60vh)] overflow-x-auto overflow-y-auto rounded-xl border border-slate-200/90 bg-slate-50/50 dark:border-slate-700/90 dark:bg-slate-950/30">
                <table className="w-full min-w-[22rem] border-collapse text-xs">
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
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Admin and manager accounts do not mark attendance. Use Executive Dashboard to monitor employee status, inactive events, and timelines.
          </p>
        </section>
      )}
    </div>
  );
}
