CREATE TABLE "leads" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"client_name" text NOT NULL,
	"phone" text,
	"email" text,
	"source" text,
	"department_id" integer,
	"assigned_user_id" integer,
	"status" text NOT NULL,
	"notes_summary" text,
	"sale_amount" numeric(12, 2),
	"service_purchased" text,
	"sale_date" date,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"_m_hot" integer,
	"_m_sale" integer
);
--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_assigned_user_id_users_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
INSERT INTO "leads" ("type", "client_name", "phone", "email", "source", "department_id", "assigned_user_id", "status", "notes_summary", "sale_amount", "service_purchased", "sale_date", "created_at", "updated_at", "_m_hot", "_m_sale")
SELECT 'hot'::text, "client_name", "phone", "email", "source", "department_id", "assigned_user_id", "status", "notes_summary", NULL, NULL, NULL, "created_at", "updated_at", "id", NULL
FROM "hot_leads";
--> statement-breakpoint
INSERT INTO "leads" ("type", "client_name", "phone", "email", "source", "department_id", "assigned_user_id", "status", "notes_summary", "sale_amount", "service_purchased", "sale_date", "created_at", "updated_at", "_m_hot", "_m_sale")
SELECT 'sale'::text, "client_name", "phone", "email", NULL, "department_id", "assigned_user_id", 'Closed'::text, "notes_summary", "sale_amount", "service_purchased", "date_of_sale", "created_at", "updated_at", NULL, "id"
FROM "sale_leads";
--> statement-breakpoint
UPDATE "lead_notes" AS n SET "lead_id" = l."id" FROM "leads" AS l WHERE n."lead_type" = 'hot' AND n."lead_id" = l."_m_hot";
--> statement-breakpoint
UPDATE "lead_notes" AS n SET "lead_id" = l."id" FROM "leads" AS l WHERE n."lead_type" = 'sale' AND n."lead_id" = l."_m_sale";
--> statement-breakpoint
ALTER TABLE "leads" DROP COLUMN "_m_hot";
--> statement-breakpoint
ALTER TABLE "leads" DROP COLUMN "_m_sale";
--> statement-breakpoint
DROP TABLE "hot_leads";
--> statement-breakpoint
DROP TABLE "sale_leads";
