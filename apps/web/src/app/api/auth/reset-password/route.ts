import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { hashPassword } from "@/lib/auth";

const bodySchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8)
});

export async function POST(req: NextRequest) {
  const raw = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid token or password (min 8 characters)" },
      { status: 400 }
    );
  }

  const { token, password } = parsed.data;

  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.resetToken, token.trim()));

  if (!user?.resetTokenExpiry) {
    return NextResponse.json(
      { error: "Invalid or expired reset link" },
      { status: 400 }
    );
  }

  if (user.resetTokenExpiry.getTime() < Date.now()) {
    return NextResponse.json(
      { error: "Invalid or expired reset link" },
      { status: 400 }
    );
  }

  const passwordHash = await hashPassword(password);

  await db
    .update(schema.users)
    .set({
      passwordHash,
      resetToken: null,
      resetTokenExpiry: null,
      updatedAt: new Date()
    })
    .where(eq(schema.users.id, user.id));

  return NextResponse.json({ success: true });
}
