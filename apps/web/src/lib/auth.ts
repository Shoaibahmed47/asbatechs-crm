import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { db } from "./db";
import { schema } from "@asbatechs-crm/database";
import { eq, sql } from "drizzle-orm";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret");
const JWT_EXPIRES_IN = "8h";
const COOKIE_NAME = "crm_token";

export type AuthTokenPayload = {
  userId: number;
  role: string;
  departmentId: number | null;
};

/** Canonical form for auth and uniqueness (Postgres compare is case-sensitive on citext-less text). */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function findUserByEmail(email: string) {
  const normalized = normalizeEmail(email);
  const [user] = await db
    .select()
    .from(schema.users)
    .where(sql`lower(${schema.users.email}) = ${normalized}`);
  return user ?? null;
}

export async function verifyPassword(
  password: string,
  passwordHash: string
): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function signAuthToken(payload: AuthTokenPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(JWT_EXPIRES_IN)
    .sign(JWT_SECRET);
}

export async function verifyAuthToken(token: string): Promise<AuthTokenPayload | null> {
  try {
    const { payload } = await jwtVerify<AuthTokenPayload>(token, JWT_SECRET);
    return {
      userId: payload.userId,
      role: payload.role,
      departmentId:
        typeof payload.departmentId === "number" ? payload.departmentId : null
    };
  } catch {
    return null;
  }
}

export { COOKIE_NAME };

