CREATE TABLE IF NOT EXISTS "attendance_office_settings" (
  "id" integer PRIMARY KEY DEFAULT 1 CHECK ("id" = 1),
  "expected_check_in_time" text NOT NULL DEFAULT '19:00',
  "shift_end_time" text NOT NULL DEFAULT '16:00',
  "updated_at" timestamp with time zone DEFAULT now(),
  "updated_by_user_id" integer REFERENCES "users"("id") ON DELETE SET NULL
);

INSERT INTO "attendance_office_settings" ("id", "expected_check_in_time", "shift_end_time")
VALUES (1, '19:00', '16:00')
ON CONFLICT ("id") DO NOTHING;
