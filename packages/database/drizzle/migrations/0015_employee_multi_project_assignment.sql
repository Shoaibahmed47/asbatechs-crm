ALTER TABLE "employee_client_project_assignments"
DROP CONSTRAINT "employee_client_project_assignments_user_id_unique";

ALTER TABLE "employee_client_project_assignments"
ADD CONSTRAINT "employee_client_project_assignments_user_project_unique"
UNIQUE ("user_id", "project_id");
