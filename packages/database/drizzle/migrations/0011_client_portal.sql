CREATE TABLE IF NOT EXISTS "client_invitations" (
  "id" serial PRIMARY KEY NOT NULL,
  "email" text NOT NULL,
  "token" text NOT NULL UNIQUE,
  "invited_by_user_id" integer NOT NULL REFERENCES "users"("id"),
  "accepted_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "clients" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "email" text NOT NULL UNIQUE,
  "password_hash" text NOT NULL,
  "company_name" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "client_projects" (
  "id" serial PRIMARY KEY NOT NULL,
  "client_id" integer NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "client_work_updates" (
  "id" serial PRIMARY KEY NOT NULL,
  "client_id" integer NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
  "project_id" integer REFERENCES "client_projects"("id") ON DELETE SET NULL,
  "title" text NOT NULL,
  "notes" text,
  "screenshot_url" text,
  "git_repo_url" text,
  "document_url" text,
  "link_url" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "client_projects_client_id_idx" ON "client_projects" ("client_id");
CREATE INDEX IF NOT EXISTS "client_work_updates_client_id_idx" ON "client_work_updates" ("client_id");
CREATE INDEX IF NOT EXISTS "client_work_updates_project_id_idx" ON "client_work_updates" ("project_id");
