ALTER TABLE "leads" ADD COLUMN "next_follow_up_date" date;
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "is_deleted" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
CREATE TABLE "notifications" (
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
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE TABLE "lead_attachments" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_id" integer NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text,
	"storage_path" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"is_deleted" boolean NOT NULL DEFAULT false
);
--> statement-breakpoint
ALTER TABLE "lead_attachments" ADD CONSTRAINT "lead_attachments_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;

