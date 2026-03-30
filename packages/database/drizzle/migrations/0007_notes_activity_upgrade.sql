ALTER TABLE "lead_notes" DROP CONSTRAINT IF EXISTS "lead_notes_author_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "lead_notes" RENAME COLUMN "author_user_id" TO "user_id";
--> statement-breakpoint
ALTER TABLE "lead_notes" RENAME COLUMN "content" TO "note";
--> statement-breakpoint
ALTER TABLE "lead_notes" DROP COLUMN "lead_type";
--> statement-breakpoint
UPDATE "lead_notes" SET "user_id" = (SELECT "id" FROM "users" ORDER BY "id" ASC LIMIT 1) WHERE "user_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "lead_notes" ALTER COLUMN "user_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "lead_notes" ADD CONSTRAINT "lead_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "lead_notes" ADD CONSTRAINT "lead_notes_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "activity_logs" DROP COLUMN IF EXISTS "metadata";
--> statement-breakpoint
UPDATE "activity_logs" SET "user_id" = "entity_id" WHERE "user_id" IS NULL AND lower("entity_type") = 'user';
--> statement-breakpoint
UPDATE "activity_logs" SET "user_id" = (SELECT "id" FROM "users" ORDER BY "id" ASC LIMIT 1) WHERE "user_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "activity_logs" ALTER COLUMN "user_id" SET NOT NULL;
