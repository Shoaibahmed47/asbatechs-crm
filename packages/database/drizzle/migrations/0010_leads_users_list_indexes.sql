CREATE INDEX IF NOT EXISTS "leads_type_deleted_created_idx" ON "leads" ("type", "is_deleted", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "leads_type_deleted_dept_idx" ON "leads" ("type", "is_deleted", "department_id");
CREATE INDEX IF NOT EXISTS "leads_type_deleted_assignee_idx" ON "leads" ("type", "is_deleted", "assigned_user_id");
CREATE INDEX IF NOT EXISTS "leads_type_deleted_status_idx" ON "leads" ("type", "is_deleted", "status");
CREATE INDEX IF NOT EXISTS "leads_sale_date_idx" ON "leads" ("sale_date") WHERE "type" = 'sale' AND "is_deleted" = false;
CREATE INDEX IF NOT EXISTS "users_dept_created_idx" ON "users" ("department_id", "created_at");
CREATE INDEX IF NOT EXISTS "invitations_pending_dept_created_idx" ON "invitations" ("department_id", "created_at") WHERE "accepted_at" IS NULL;
