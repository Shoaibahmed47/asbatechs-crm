import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { hashPassword } from "@/lib/auth";

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  departmentId: z.number().nullable().optional(),
  role: z.enum(["admin", "employee"])
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid registration data", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { name, email, password, departmentId, role } = parsed.data;

  const [existing] = await db
    .select()
    .from(schema.users)
    .where(schema.users.email.eq(email) as any);
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

