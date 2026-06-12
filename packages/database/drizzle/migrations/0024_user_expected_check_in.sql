ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "expected_check_in_time" text;
