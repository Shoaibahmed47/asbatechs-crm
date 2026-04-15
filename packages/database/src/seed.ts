import "dotenv/config";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

import { createDb, schema } from ".";

const DEFAULT_ADMIN_EMAIL = "admin@crm.com";
const DEFAULT_ADMIN_PASSWORD = "admin123";
const DEFAULT_ADMIN_NAME = "Default Admin";

/** Demo employee for local/dev (same login page as admin; complete invite flow in production). */
const DEFAULT_EMPLOYEE_EMAIL = "employee@crm.com";
const DEFAULT_EMPLOYEE_PASSWORD = "employee123";
const DEFAULT_EMPLOYEE_NAME = "Demo Employee";
const DEFAULT_CLIENT_EMAIL = "client@demo.com";
const DEFAULT_CLIENT_PASSWORD = "client123";
const DEFAULT_CLIENT_NAME = "Demo Client";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  const db = createDb(databaseUrl);

  const salt = await bcrypt.genSalt(10);
  const adminHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, salt);
  const employeeHash = await bcrypt.hash(DEFAULT_EMPLOYEE_PASSWORD, salt);
  const clientHash = await bcrypt.hash(DEFAULT_CLIENT_PASSWORD, salt);

  const [existingAdmin] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, DEFAULT_ADMIN_EMAIL));

  if (existingAdmin) {
    await db
      .update(schema.users)
      .set({
        name: DEFAULT_ADMIN_NAME,
        passwordHash: adminHash,
        role: "admin",
        departmentId: null
      })
      .where(eq(schema.users.id, existingAdmin.id));

    console.log(
      `Admin user with email ${DEFAULT_ADMIN_EMAIL} already exists. Password and role reset.`
    );
  } else {
    await db.insert(schema.users).values({
      name: DEFAULT_ADMIN_NAME,
      email: DEFAULT_ADMIN_EMAIL,
      passwordHash: adminHash,
      role: "admin",
      departmentId: null
    });

    console.log(
      `Admin user created with email ${DEFAULT_ADMIN_EMAIL} and default password.`
    );
  }

  const [existingEmployee] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, DEFAULT_EMPLOYEE_EMAIL));

  if (existingEmployee) {
    await db
      .update(schema.users)
      .set({
        name: DEFAULT_EMPLOYEE_NAME,
        passwordHash: employeeHash,
        role: "employee",
        departmentId: existingEmployee.departmentId
      })
      .where(eq(schema.users.id, existingEmployee.id));

    console.log(
      `Employee user with email ${DEFAULT_EMPLOYEE_EMAIL} already exists. Password and role reset to defaults.`
    );
  } else {
    await db.insert(schema.users).values({
      name: DEFAULT_EMPLOYEE_NAME,
      email: DEFAULT_EMPLOYEE_EMAIL,
      passwordHash: employeeHash,
      role: "employee",
      departmentId: null,
      inviteStatus: "accepted"
    });

    console.log(
      `Demo employee created: ${DEFAULT_EMPLOYEE_EMAIL} (password in repo seed — change in production).`
    );
  }

  const [existingClient] = await db
    .select()
    .from(schema.clients)
    .where(eq(schema.clients.email, DEFAULT_CLIENT_EMAIL));

  if (existingClient) {
    await db
      .update(schema.clients)
      .set({
        name: DEFAULT_CLIENT_NAME,
        passwordHash: clientHash,
        companyName: "Demo Company"
      })
      .where(eq(schema.clients.id, existingClient.id));

    console.log(
      `Client user with email ${DEFAULT_CLIENT_EMAIL} already exists. Password reset to default.`
    );
  } else {
    await db.insert(schema.clients).values({
      name: DEFAULT_CLIENT_NAME,
      email: DEFAULT_CLIENT_EMAIL,
      passwordHash: clientHash,
      companyName: "Demo Company"
    });

    console.log(
      `Demo client created: ${DEFAULT_CLIENT_EMAIL} (password in repo seed — change in production).`
    );
  }

  console.log(
    "\nSign-in (same /login for everyone): admin → " +
      DEFAULT_ADMIN_EMAIL +
      " / " +
      DEFAULT_ADMIN_PASSWORD +
      " | demo employee → " +
      DEFAULT_EMPLOYEE_EMAIL +
      " / " +
      DEFAULT_EMPLOYEE_PASSWORD +
      " | demo client (/client/login) → " +
      DEFAULT_CLIENT_EMAIL +
      " / " +
      DEFAULT_CLIENT_PASSWORD +
      "\n"
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

