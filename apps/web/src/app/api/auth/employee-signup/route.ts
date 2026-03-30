import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { hashPassword } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  if (!body || typeof body.token !== "string" || typeof body.password !== "string") {
    return NextResponse.json({ error: "Invalid signup data" }, { status: 400 });
  }

  const token = body.token.trim();
  const password = body.password;

  if (!token) {
    return NextResponse.json({ error: "Invalid or missing token" }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters long" },
      { status: 400 }
    );
  }

  const [invite] = await db
    .select()
    .from(schema.invitations)
    .where(eq(schema.invitations.token, token));

  if (!invite) {
    return NextResponse.json(
      { error: "Invalid or expired invitation" },
      { status: 400 }
    );
  }

  const [existing] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, invite.email));

  if (existing) {
    return NextResponse.json({ error: "User already exists" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);

  const [user] = await db
    .insert(schema.users)
    .values({
      name: invite.email,
      email: invite.email,
      passwordHash,
      role: "employee",
      departmentId: invite.departmentId ?? null,
      inviteStatus: "accepted",
      inviteToken: null,
      resetToken: null,
      resetTokenExpiry: null
    })
    .returning();

  await db
    .update(schema.invitations)
    .set({ acceptedAt: new Date() })
    .where(eq(schema.invitations.id, invite.id));

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      role: user.role
    }
  });
}

