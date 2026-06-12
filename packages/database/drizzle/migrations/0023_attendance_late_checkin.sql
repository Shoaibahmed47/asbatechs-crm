ALTER TABLE "attendance_logs"
  ADD COLUMN IF NOT EXISTS "late_minutes" integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "expected_check_in_time" text,
  ADD COLUMN IF NOT EXISTS "late_reason" text,
  ADD COLUMN IF NOT EXISTS "late_reason_submitted_at" timestamp with time zone;
