/**
 * Align with apps/web/src/lib/attendance-policy.ts
 * (ATTENDANCE_LAPTOP_SLEEP_DETECT_SECONDS = 2 minutes).
 */
export const ATTENDANCE_ACTIVITY_PING_SECONDS = 60;
export const ATTENDANCE_CURSOR_IDLE_AWAY_SECONDS = 10;
/** Wait this long after lock/sleep before posting away (detect). */
export const ATTENDANCE_LAPTOP_SLEEP_AWAY_SECONDS = 2 * 60;
export const ATTENDANCE_POLL_SECONDS = 10;
export const ATTENDANCE_CURSOR_IDLE_ENABLED = false;

export const APP_TITLE = "AsbaTechs CRM";
export const MIN_WINDOW_WIDTH = 1180;
export const MIN_WINDOW_HEIGHT = 720;

export function isAllowedNavigationUrl(targetUrl: string, crmOrigin: string): boolean {
  try {
    const parsed = new URL(targetUrl);
    const allowed = new URL(crmOrigin);
    return parsed.origin === allowed.origin;
  } catch {
    return false;
  }
}
