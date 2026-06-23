/** Align with apps/web/src/lib/attendance-policy.ts defaults. */
export const ATTENDANCE_ACTIVITY_PING_SECONDS = 60;
export const ATTENDANCE_CURSOR_IDLE_AWAY_SECONDS = 10;
export const ATTENDANCE_LAPTOP_SLEEP_AWAY_SECONDS = 10;
export const ATTENDANCE_POLL_SECONDS = 10;
export const ATTENDANCE_CURSOR_IDLE_ENABLED = false;

export const APP_TITLE = "AsbaTechs CRM";
export const MIN_WINDOW_WIDTH = 1180;
export const MIN_WINDOW_HEIGHT = 720;

export function resolveCrmAppUrl(): string {
  const fromEnv = process.env.CRM_APP_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return "http://localhost:3000";
}

export function isAllowedNavigationUrl(targetUrl: string, crmOrigin: string): boolean {
  try {
    const parsed = new URL(targetUrl);
    const allowed = new URL(crmOrigin);
    return parsed.origin === allowed.origin;
  } catch {
    return false;
  }
}
