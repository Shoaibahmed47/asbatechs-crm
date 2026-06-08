ALTER TABLE "attendance_logs"
  ADD COLUMN IF NOT EXISTS "tab_close_minutes" integer DEFAULT 0;

ALTER TABLE "attendance_logs"
  ADD COLUMN IF NOT EXISTS "tab_close_events_count" integer DEFAULT 0;

ALTER TABLE "attendance_logs"
  ADD COLUMN IF NOT EXISTS "cursor_away_minutes" integer DEFAULT 0;

ALTER TABLE "attendance_logs"
  ADD COLUMN IF NOT EXISTS "cursor_away_events_count" integer DEFAULT 0;
