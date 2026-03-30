import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { hashPassword } from "@/lib/auth";

export const DEFAULT_ADMIN_EMAIL = "admin@crm.com";
const DEFAULT_ADMIN_PASSWORD = "admin123";
const DEFAULT_ADMIN_NAME = "Default Admin";

let ensured = false;

export async function ensureDefaultAdmin() {
  if (ensured) return;
  ensured = true;

  const [existing] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, DEFAULT_ADMIN_EMAIL));

  if (existing) return;

  const passwordHash = await hashPassword(DEFAULT_ADMIN_PASSWORD);

  await db.insert(schema.users).values({
    name: DEFAULT_ADMIN_NAME,
    email: DEFAULT_ADMIN_EMAIL,
    passwordHash,
    role: "admin",
    departmentId: null
  });
}

export async function getDefaultAdminUserId(): Promise<number> {
  await ensureDefaultAdmin();

  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, DEFAULT_ADMIN_EMAIL));

  if (!user) {
    throw new Error("Default admin user not found after ensureDefaultAdmin");
  }

  return user.id;
}

