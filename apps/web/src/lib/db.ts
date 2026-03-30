import { createDb } from "@asbatechs-crm/database";

const databaseUrl =
  process.env.DATABASE_URL ??
  (process.env.NODE_ENV === "development"
    ? "postgresql://postgres:admin@localhost:5432/asbatechs-crm-db"
    : undefined);

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set for web app");
}

if (process.env.NODE_ENV === "development" && !process.env.DATABASE_URL) {
  console.warn(
    "[dev] DATABASE_URL not set; using default local Postgres. Set DATABASE_URL in .env.local to use your own database."
  );
}

export const db = createDb(databaseUrl);

