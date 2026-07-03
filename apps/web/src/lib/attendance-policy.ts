/** Heartbeat while employee is active on attendance (browser). */
export const ATTENDANCE_ACTIVITY_PING_SECONDS = 120;
export const ATTENDANCE_ACTIVITY_PING_MS = ATTENDANCE_ACTIVITY_PING_SECONDS * 1000;

// Agent health thresholds
export const ATTENDANCE_AGENT_RUNNING_SECONDS = 300;
export const ATTENDANCE_AGENT_INSTALLED_SECONDS = 1800;
export const ATTENDANCE_AGENT_ALERT_STALE_MINUTES = 10;

/**
 * Short away-compliance thresholds (seconds). Change here before deploy — all
 * browser, API, and desktop-agent defaults read from these values.
 */
/**
 * FUTURE: mouse/keyboard idle tracking.
 * Disabled for now — set to `true` and uncomment client blocks in AttendancePageClient.
 */
export const ATTENDANCE_CURSOR_IDLE_ENABLED = false;

/** FUTURE: set true to allow a second break with a written reason (extra break). */
export const ATTENDANCE_EXTRA_BREAK_ENABLED = false;

/**
 * Dev/testing: late-arrival popup same day (right after a late clock-in).
 * Production: keep false — popup only on the next calendar day.
 * Auto-on in development unless ATTENDANCE_LATE_EXPLANATION_TEST_MODE=false.
 */
export const ATTENDANCE_LATE_EXPLANATION_TEST_MODE =
  process.env.ATTENDANCE_LATE_EXPLANATION_TEST_MODE === "true" ||
  (process.env.NODE_ENV === "development" &&
    process.env.ATTENDANCE_LATE_EXPLANATION_TEST_MODE !== "false");

/** Browser tab unload only (not switching to another tab). */
export const ATTENDANCE_TAB_CLOSE_AWAY_SECONDS = 60;

/** Max days in one employee period export (CEO reports). */
export const MAX_ATTENDANCE_PERIOD_DAYS = 93;
export const ATTENDANCE_CURSOR_IDLE_AWAY_SECONDS = 60;
export const ATTENDANCE_LAPTOP_SLEEP_AWAY_SECONDS = 60;

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
  laptopSleepAwaySeconds: ATTENDANCE_LAPTOP_SLEEP_AWAY_SECONDS,
  cursorIdleEnabled: ATTENDANCE_CURSOR_IDLE_ENABLED,
  lateExplanationTestMode: ATTENDANCE_LATE_EXPLANATION_TEST_MODE
} as const;
