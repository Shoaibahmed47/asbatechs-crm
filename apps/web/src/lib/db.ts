import { createDb } from "@asbatechs-crm/database";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set for web app");
}

export const db = createDb(databaseUrl);

