ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "pending_expected_check_in_time" text,
  ADD COLUMN IF NOT EXISTS "pending_expected_shift_end_time" text,
  ADD COLUMN IF NOT EXISTS "schedule_effective_from" date;
