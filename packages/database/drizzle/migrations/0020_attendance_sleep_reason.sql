ALTER TABLE "attendance_logs"
  ADD COLUMN IF NOT EXISTS "sleep_minutes" integer DEFAULT 0;

ALTER TABLE "attendance_logs"
  ADD COLUMN IF NOT EXISTS "sleep_events_count" integer DEFAULT 0;

ALTER TABLE "break_sessions"
  ADD COLUMN IF NOT EXISTS "unscheduled_cause" text;
