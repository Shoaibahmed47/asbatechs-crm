ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "due_at" timestamp with time zone;
--> statement-breakpoint
UPDATE "notifications"
SET "due_at" = ("due_date"::text || 'T09:00:00Z')::timestamptz
WHERE "due_date" IS NOT NULL
  AND "due_at" IS NULL;
