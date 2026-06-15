import dns from "dns";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

export { schema };
export * from "./schema";

export type Database = ReturnType<typeof drizzle<typeof schema>>;

function normalizePoolerUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.port === "6543" && !parsed.searchParams.has("pgbouncer")) {
      parsed.searchParams.set("pgbouncer", "true");
      return parsed.toString();
    }
  } catch {
    /* keep original connection string */
  }
  return url;
}

export function createDb(url: string) {
  // Prefer IPv4 first on Windows/home networks where IPv6/DNS intermittency can
  // cause ENOTFOUND/ETIMEDOUT spikes against managed Postgres endpoints.
  dns.setDefaultResultOrder("ipv4first");

  const connectionString = normalizePoolerUrl(url);
  const parsed = new URL(connectionString);
  const sslMode = parsed.searchParams.get("sslmode");
  const ssl =
    sslMode === "no-verify"
      ? { rejectUnauthorized: false }
      : undefined;

  const pool = new Pool({
    connectionString,
    ssl,
    max: Number(process.env.PG_POOL_MAX ?? 10),
    connectionTimeoutMillis: Number(process.env.PG_CONNECT_TIMEOUT_MS ?? 30000),
    idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS ?? 30000),
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000
  });
  return drizzle(pool, { schema });
}

