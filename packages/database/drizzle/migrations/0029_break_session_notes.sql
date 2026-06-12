ALTER TABLE "break_sessions"
  ADD COLUMN IF NOT EXISTS "break_category" text,
  ADD COLUMN IF NOT EXISTS "start_note" text,
  ADD COLUMN IF NOT EXISTS "end_note" text;
