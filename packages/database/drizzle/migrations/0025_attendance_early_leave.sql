ALTER TABLE "attendance_logs"
  ADD COLUMN IF NOT EXISTS "early_leave_minutes" integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "expected_shift_end_time" text;
