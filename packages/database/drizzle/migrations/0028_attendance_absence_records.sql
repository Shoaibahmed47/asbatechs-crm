CREATE TABLE IF NOT EXISTS "attendance_absence_records" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "users"("id"),
  "date" date NOT NULL,
  "reason" text NOT NULL,
  "reason_submitted_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "attendance_absence_records_user_date_idx"
  ON "attendance_absence_records" ("user_id", "date");
