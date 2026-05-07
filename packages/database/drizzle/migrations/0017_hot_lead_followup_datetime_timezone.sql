ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "next_follow_up_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "follow_up_timezone" text;
--> statement-breakpoint
UPDATE "leads"
SET "next_follow_up_at" = ("next_follow_up_date"::text || 'T09:00:00Z')::timestamptz
WHERE "type" = 'hot'
  AND "next_follow_up_date" IS NOT NULL
  AND "next_follow_up_at" IS NULL;
