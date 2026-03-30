ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "next_follow_up_date" date;
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "is_deleted" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"type" text NOT NULL,
	"lead_id" integer,
	"message" text NOT NULL,
	"due_date" date,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'notifications_user_id_users_id_fk'
  ) THEN
    ALTER TABLE "notifications"
      ADD CONSTRAINT "notifications_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'notifications_lead_id_leads_id_fk'
  ) THEN
    ALTER TABLE "notifications"
      ADD CONSTRAINT "notifications_lead_id_leads_id_fk"
      FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END
$$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lead_attachments" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_id" integer NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text,
	"storage_path" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"is_deleted" boolean NOT NULL DEFAULT false
);
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'lead_attachments_lead_id_leads_id_fk'
  ) THEN
    ALTER TABLE "lead_attachments"
      ADD CONSTRAINT "lead_attachments_lead_id_leads_id_fk"
      FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END
$$;

