import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import {
  COOKIE_NAME,
  hashPassword,
  verifyAuthToken,
  findUserByEmail,
  normalizeEmail
} from "@/lib/auth";

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  departmentId: z.number().nullable().optional(),
  role: z.enum(["admin", "manager", "employee"])
});

export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const payload = token ? await verifyAuthToken(token) : null;

  if (!payload || payload.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid registration data", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { name, password, departmentId, role } = parsed.data;
  const email = normalizeEmail(parsed.data.email);

  const existing = await findUserByEmail(email);
  if (existing) {
    return NextResponse.json({ error: "Email already in use" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);

  const [user] = await db
    .insert(schema.users)
    .values({
      name,
      email,
      passwordHash,
      role,
      departmentId: departmentId ?? null
    })
    .returning();

  await db.insert(schema.activityLogs).values({
    userId: payload.userId,
    action: "user_created",
    entityType: "user",
    entityId: user.id
  });

  return NextResponse.json(
    {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        departmentId: user.departmentId
      }
    },
    { status: 201 }
  );
}

