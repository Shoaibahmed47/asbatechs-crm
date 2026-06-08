/** Heartbeat while employee is active on attendance (browser). */
export const ATTENDANCE_ACTIVITY_PING_SECONDS = 60;
export const ATTENDANCE_ACTIVITY_PING_MS = ATTENDANCE_ACTIVITY_PING_SECONDS * 1000;

// Agent health thresholds
export const ATTENDANCE_AGENT_RUNNING_SECONDS = 180;
export const ATTENDANCE_AGENT_INSTALLED_SECONDS = 1800;
export const ATTENDANCE_AGENT_ALERT_STALE_MINUTES = 10;

/**
 * Short away-compliance thresholds (seconds). Change here before deploy — all
 * browser, API, and desktop-agent defaults read from these values.
 */
/** Browser tab unload only (not switching to another tab). */
export const ATTENDANCE_TAB_CLOSE_AWAY_SECONDS = 10;
export const ATTENDANCE_CURSOR_IDLE_AWAY_SECONDS = 10;
export const ATTENDANCE_LAPTOP_SLEEP_AWAY_SECONDS = 10;

export const ATTENDANCE_TAB_CLOSE_AWAY_MS =
  ATTENDANCE_TAB_CLOSE_AWAY_SECONDS * 1000;
export const ATTENDANCE_CURSOR_IDLE_AWAY_MS =
  ATTENDANCE_CURSOR_IDLE_AWAY_SECONDS * 1000;
export const ATTENDANCE_LAPTOP_SLEEP_AWAY_MS =
  ATTENDANCE_LAPTOP_SLEEP_AWAY_SECONDS * 1000;

/** Public policy payload for employee clients (same source as server enforcement). */
export const ATTENDANCE_AWAY_POLICY = {
  tabCloseAwaySeconds: ATTENDANCE_TAB_CLOSE_AWAY_SECONDS,
  cursorIdleAwaySeconds: ATTENDANCE_CURSOR_IDLE_AWAY_SECONDS,
  laptopSleepAwaySeconds: ATTENDANCE_LAPTOP_SLEEP_AWAY_SECONDS
} as const;
