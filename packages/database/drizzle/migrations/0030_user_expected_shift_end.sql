ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "expected_shift_end_time" text;
