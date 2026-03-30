import "dotenv/config";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

import { createDb, schema } from ".";

const DEFAULT_ADMIN_EMAIL = "admin@crm.com";
const DEFAULT_ADMIN_PASSWORD = "admin123";
const DEFAULT_ADMIN_NAME = "Default Admin";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  const db = createDb(databaseUrl);

  const [existingAdmin] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, DEFAULT_ADMIN_EMAIL));

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, salt);

  if (existingAdmin) {
    await db
      .update(schema.users)
      .set({
        name: DEFAULT_ADMIN_NAME,
        passwordHash,
        role: "admin",
        departmentId: null
      })
      .where(eq(schema.users.id, existingAdmin.id));

    console.log(
      `Admin user with email ${DEFAULT_ADMIN_EMAIL} already exists. Password and role reset.`
    );
    return;
  }

  await db.insert(schema.users).values({
    name: DEFAULT_ADMIN_NAME,
    email: DEFAULT_ADMIN_EMAIL,
    passwordHash,
    role: "admin",
    departmentId: null
  });

  console.log(
    `Admin user created with email ${DEFAULT_ADMIN_EMAIL} and default password.`
  );
}

main()
  .then(() => {
    console.log("Database seed completed successfully.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Database seed failed:", error);
    process.exit(1);
  });

