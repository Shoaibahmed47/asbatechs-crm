CREATE TABLE "employee_client_project_assignments" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL,
  "client_id" integer NOT NULL,
  "project_id" integer NOT NULL,
  "assigned_by_user_id" integer,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "employee_client_project_assignments_user_id_unique" UNIQUE("user_id")
);

ALTER TABLE "employee_client_project_assignments"
ADD CONSTRAINT "employee_client_project_assignments_user_id_users_id_fk"
FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "employee_client_project_assignments"
ADD CONSTRAINT "employee_client_project_assignments_client_id_clients_id_fk"
FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "employee_client_project_assignments"
ADD CONSTRAINT "employee_client_project_assignments_project_id_client_projects_id_fk"
FOREIGN KEY ("project_id") REFERENCES "public"."client_projects"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "employee_client_project_assignments"
ADD CONSTRAINT "employee_client_project_assignments_assigned_by_user_id_users_id_fk"
FOREIGN KEY ("assigned_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
