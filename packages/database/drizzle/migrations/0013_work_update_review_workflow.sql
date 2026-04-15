ALTER TABLE "client_work_updates"
ADD COLUMN "status" text NOT NULL DEFAULT 'submitted';

ALTER TABLE "client_work_updates"
ADD COLUMN "reviewed_at" timestamp with time zone;

CREATE TABLE "client_work_comments" (
  "id" serial PRIMARY KEY NOT NULL,
  "work_update_id" integer NOT NULL,
  "actor_type" text NOT NULL,
  "actor_user_id" integer,
  "actor_client_id" integer,
  "body" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now()
);

ALTER TABLE "client_work_comments"
ADD CONSTRAINT "client_work_comments_work_update_id_client_work_updates_id_fk"
FOREIGN KEY ("work_update_id") REFERENCES "public"."client_work_updates"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "client_work_comments"
ADD CONSTRAINT "client_work_comments_actor_user_id_users_id_fk"
FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "client_work_comments"
ADD CONSTRAINT "client_work_comments_actor_client_id_clients_id_fk"
FOREIGN KEY ("actor_client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;
