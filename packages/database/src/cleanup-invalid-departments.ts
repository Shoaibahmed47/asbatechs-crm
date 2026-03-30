import "dotenv/config";
import { inArray, sql } from "drizzle-orm";
import { createDb, schema } from ".";

/**
 * Removes only junk department rows:
 * - name is empty after trim
 * - name is the literal string "null" (any case), after trim
 *
 * Before delete: clears department_id on users, leads, invitations
 * that pointed at those rows so no FK errors and no user/lead rows are deleted.
 */
async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  const db = createDb(databaseUrl);

  const invalid = await db
    .select({
      id: schema.departments.id,
      name: schema.departments.name
    })
    .from(schema.departments)
    .where(
      sql`trim(lower(${schema.departments.name})) = 'null' OR trim(${schema.departments.name}) = ''`
    );

  if (invalid.length === 0) {
    console.log("No invalid department rows found. Nothing to clean.");
    process.exit(0);
  }

  console.log(
    "Invalid department rows to remove:",
    invalid.map((r) => ({ id: r.id, name: JSON.stringify(r.name) }))
  );

  const ids = invalid.map((r) => r.id);

  await db
    .update(schema.users)
    .set({ departmentId: null })
    .where(inArray(schema.users.departmentId, ids));

  await db
    .update(schema.leads)
    .set({ departmentId: null })
    .where(inArray(schema.leads.departmentId, ids));

  await db
    .update(schema.invitations)
    .set({ departmentId: null })
    .where(inArray(schema.invitations.departmentId, ids));

  await db.delete(schema.departments).where(inArray(schema.departments.id, ids));

  console.log(`Deleted ${ids.length} invalid department row(s).`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Cleanup failed:", err);
  process.exit(1);
});
