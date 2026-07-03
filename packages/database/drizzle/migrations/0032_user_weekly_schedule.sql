ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "weekly_schedule_enabled" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "weekly_schedule" jsonb,
  ADD COLUMN IF NOT EXISTS "pending_weekly_schedule" jsonb;
