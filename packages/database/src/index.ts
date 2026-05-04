import dns from "dns";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

export { schema };
export * from "./schema";

export type Database = ReturnType<typeof drizzle<typeof schema>>;

export function createDb(url: string) {
  // Prefer IPv4 first on Windows/home networks where IPv6/DNS intermittency can
  // cause ENOTFOUND/ETIMEDOUT spikes against managed Postgres endpoints.
  dns.setDefaultResultOrder("ipv4first");

  const parsed = new URL(url);
  const sslMode = parsed.searchParams.get("sslmode");
  const ssl =
    sslMode === "no-verify"
      ? { rejectUnauthorized: false }
      : undefined;

  const pool = new Pool({
    connectionString: url,
    ssl,
    max: Number(process.env.PG_POOL_MAX ?? 12),
    connectionTimeoutMillis: Number(process.env.PG_CONNECT_TIMEOUT_MS ?? 10000),
    idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS ?? 30000),
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000
  });
  return drizzle(pool, { schema });
}

