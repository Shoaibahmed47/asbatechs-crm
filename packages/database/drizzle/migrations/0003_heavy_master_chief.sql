ALTER TABLE "attendance_logs" ADD COLUMN "status" text DEFAULT 'offline' NOT NULL;--> statement-breakpoint
ALTER TABLE "attendance_logs" ADD COLUMN "total_hours" numeric(8, 2);