import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { eq } from "drizzle-orm";
import { COOKIE_NAME, verifyAuthToken, hashPassword } from "@/lib/auth";
import { isRole } from "@/lib/rbac";

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["admin", "manager", "employee"]),
  departmentId: z.number().nullable().optional()
});

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const payload = token ? await verifyAuthToken(token) : null;
  if (!payload || !isRole(payload.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (payload.role === "admin") {
    const users = await db
      .select()
      .from(schema.users)
      .orderBy(schema.users.createdAt);
    return NextResponse.json({ users });
  }

  if (payload.role === "manager") {
    if (!payload.departmentId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const users = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.departmentId, payload.departmentId))
      .orderBy(schema.users.createdAt);
    return NextResponse.json({ users });
  }

  // employee
  const users = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, payload.userId))
    .orderBy(schema.users.createdAt);
  return NextResponse.json({ users });
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const payload = token ? await verifyAuthToken(token) : null;

  if (!payload || payload.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid user data", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { name, email, password, role, departmentId } = parsed.data;

  const [existing] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email));
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

