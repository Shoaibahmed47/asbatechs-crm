ALTER TABLE "users" ADD COLUMN "supabase_auth_id" text;
ALTER TABLE "users" ADD CONSTRAINT "users_supabase_auth_id_unique" UNIQUE("supabase_auth_id");
