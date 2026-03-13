import "dotenv/config";
import type { Config } from "drizzle-kit";

const config: Config = {
  schema: "./src/schema.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL as string
  }
};

export default config;

