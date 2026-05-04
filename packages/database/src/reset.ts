import "dotenv/config";
import { Client } from "pg";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  const client = new Client({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes("sslmode=no-verify")
      ? { rejectUnauthorized: false }
      : undefined
  });

  await client.connect();
  try {
    await client.query(`
      DO $$
      DECLARE
        table_name text;
      BEGIN
        FOR table_name IN
          SELECT tablename
          FROM pg_tables
          WHERE schemaname = 'public'
            AND tablename <> '__drizzle_migrations'
        LOOP
          EXECUTE format(
            'TRUNCATE TABLE %I.%I RESTART IDENTITY CASCADE',
            'public',
            table_name
          );
        END LOOP;
      END $$;
    `);
    console.log("Supabase/public data cleared successfully.");
  } finally {
    await client.end();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Database clear failed:", error);
    process.exit(1);
  });
