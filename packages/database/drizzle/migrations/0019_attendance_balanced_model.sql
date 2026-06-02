ALTER TABLE "attendance_logs"
ADD COLUMN IF NOT EXISTS "unscheduled_idle_minutes" integer DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "attendance_logs"
ADD COLUMN IF NOT EXISTS "idle_events_count" integer DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "attendance_logs"
ADD COLUMN IF NOT EXISTS "last_activity_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "attendance_logs"
ADD COLUMN IF NOT EXISTS "last_activity_source" text;
--> statement-breakpoint
ALTER TABLE "break_sessions"
ADD COLUMN IF NOT EXISTS "break_type" text NOT NULL DEFAULT 'manual';
--> statement-breakpoint
ALTER TABLE "break_sessions"
ADD COLUMN IF NOT EXISTS "return_reason" text;
