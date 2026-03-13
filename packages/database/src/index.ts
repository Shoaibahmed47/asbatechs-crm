import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

export { schema };
export * from "./schema";

export type Database = ReturnType<typeof drizzle<typeof schema>>;

export function createDb(url: string) {
  const pool = new Pool({ connectionString: url });
  return drizzle(pool, { schema });
}

