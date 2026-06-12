ALTER TABLE "attendance_logs"
  ADD COLUMN IF NOT EXISTS "early_leave_reason" text,
  ADD COLUMN IF NOT EXISTS "early_leave_reason_submitted_at" timestamp with time zone;
