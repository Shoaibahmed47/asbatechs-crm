import { powerMonitor } from "electron";
import type { AuthSession } from "./auth-session";
import {
  ATTENDANCE_ACTIVITY_PING_SECONDS,
  ATTENDANCE_CURSOR_IDLE_AWAY_SECONDS,
  ATTENDANCE_CURSOR_IDLE_ENABLED,
  ATTENDANCE_LAPTOP_SLEEP_AWAY_SECONDS,
  ATTENDANCE_POLL_SECONDS
} from "../shared/config";
import type { ActivityEvent } from "../shared/types";

type MonitorState = {
  cursorAwaySent: boolean;
  sessionLocked: boolean;
  lockStartedAt: number | null;
  lockAwaySent: boolean;
  nextActivityPingAt: number;
  nextAwayCheckAt: number;
  running: boolean;
  interval: NodeJS.Timeout | null;
};

export class AttendanceMonitor {
  private auth: AuthSession;
  private baseUrl: string;
  private state: MonitorState = {
    cursorAwaySent: false,
    sessionLocked: false,
    lockStartedAt: null,
    lockAwaySent: false,
    nextActivityPingAt: 0,
    nextAwayCheckAt: 0,
    running: false,
    interval: null
  };

  constructor(baseUrl: string, auth: AuthSession) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.auth = auth;
  }

  start(): void {
    if (this.state.running) return;
    this.state.running = true;
    this.resetSleepState();

    powerMonitor.on("lock-screen", this.onLock);
    powerMonitor.on("unlock-screen", this.onUnlock);
    powerMonitor.on("suspend", this.onSuspend);
    powerMonitor.on("resume", this.onResume);

    void this.runTick();
    this.state.interval = setInterval(() => {
      void this.runTick();
    }, ATTENDANCE_POLL_SECONDS * 1000);
  }

  stop(): void {
    if (!this.state.running) return;
    this.state.running = false;
    if (this.state.interval) {
      clearInterval(this.state.interval);
      this.state.interval = null;
    }
    powerMonitor.removeListener("lock-screen", this.onLock);
    powerMonitor.removeListener("unlock-screen", this.onUnlock);
    powerMonitor.removeListener("suspend", this.onSuspend);
    powerMonitor.removeListener("resume", this.onResume);
  }

  private onLock = (): void => {
    this.state.sessionLocked = true;
    this.state.lockStartedAt = Date.now();
    this.state.lockAwaySent = false;
    this.state.cursorAwaySent = false;
  };

  private onUnlock = (): void => {
    if (this.state.lockAwaySent) {
      void this.postEvent("unlock", "sleep");
    }
    this.resetSleepState();
  };

  private onSuspend = (): void => {
    this.state.sessionLocked = true;
    this.state.lockStartedAt = Date.now();
    this.state.cursorAwaySent = false;
    void this.postEvent("lock", "sleep");
    this.state.lockAwaySent = true;
  };

  private onResume = (): void => {
    if (this.state.lockAwaySent || this.state.sessionLocked) {
      void this.postEvent("unlock", "sleep");
    }
    this.resetSleepState();
  };

  private resetSleepState(): void {
    this.state.sessionLocked = false;
    this.state.lockStartedAt = null;
    this.state.lockAwaySent = false;
    this.state.cursorAwaySent = false;
  }

  private async runTick(): Promise<void> {
    if (!this.auth.isEmployee()) return;

    const now = Date.now();
    const idleSeconds = powerMonitor.getSystemIdleTime();
    const skipCursorIdle = this.state.sessionLocked;
    const cursorThreshold = ATTENDANCE_CURSOR_IDLE_AWAY_SECONDS;

    if (ATTENDANCE_CURSOR_IDLE_ENABLED) {
      if (
        !skipCursorIdle &&
        !this.state.cursorAwaySent &&
        idleSeconds >= cursorThreshold
      ) {
        this.state.cursorAwaySent = true;
        await this.postEvent("away_start", "cursor_idle");
      }

      if (
        !skipCursorIdle &&
        this.state.cursorAwaySent &&
        idleSeconds < cursorThreshold
      ) {
        this.state.cursorAwaySent = false;
        await this.postEvent("away_end", "cursor_idle");
      }

      if (
        !skipCursorIdle &&
        this.state.cursorAwaySent &&
        idleSeconds >= cursorThreshold &&
        now >= this.state.nextAwayCheckAt
      ) {
        await this.postEvent("activity");
        this.state.nextAwayCheckAt = now + 3000;
      }

      if (
        !skipCursorIdle &&
        now >= this.state.nextActivityPingAt &&
        idleSeconds < cursorThreshold &&
        !this.state.cursorAwaySent
      ) {
        await this.postEvent("activity");
        this.state.nextActivityPingAt = now + ATTENDANCE_ACTIVITY_PING_SECONDS * 1000;
      }
    } else if (now >= this.state.nextActivityPingAt) {
      await this.postEvent("activity");
      this.state.nextActivityPingAt = now + ATTENDANCE_ACTIVITY_PING_SECONDS * 1000;
    }

    if (
      this.state.sessionLocked &&
      !this.state.lockAwaySent &&
      this.state.lockStartedAt != null &&
      (now - this.state.lockStartedAt) / 1000 >= ATTENDANCE_LAPTOP_SLEEP_AWAY_SECONDS
    ) {
      this.state.lockAwaySent = true;
      await this.postEvent("lock", "sleep");
    }
  }

  private async postEvent(
    event: ActivityEvent,
    awayCause?: string | null
  ): Promise<void> {
    const token = await this.auth.getBearerToken();
    if (!token) return;

    const payload = {
      event,
      source: "electron",
      awayCause: awayCause ?? undefined,
      observedAt: new Date().toISOString()
    };

    let res = await fetch(`${this.baseUrl}/api/attendance/activity`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (res.status === 401) {
      const refreshed = await this.auth.getBearerToken(true);
      if (!refreshed) return;
      res = await fetch(`${this.baseUrl}/api/attendance/activity`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${refreshed}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
    }
  }
}
