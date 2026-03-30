import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { sendPasswordResetEmail } from "@/lib/mail";

const bodySchema = z.object({
  email: z.string().email()
});

export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const payload = token ? await verifyAuthToken(token) : null;

  if (!payload || payload.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const raw = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const email = parsed.data.email.trim().toLowerCase();

  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email));

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const resetToken = randomBytes(32).toString("hex");
  const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000);
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";

  try {
    await db
      .update(schema.users)
      .set({
        resetToken,
        resetTokenExpiry,
        updatedAt: new Date()
      })
      .where(eq(schema.users.id, user.id));

    await sendPasswordResetEmail(
      email,
      `${appUrl}/reset-password/${resetToken}`
    );

    return NextResponse.json({
      success: true,
      message: "Password reset link sent"
    });
  } catch (error) {
    console.error("reset-password:", error);
    return NextResponse.json(
      { error: "Failed to send reset email. Check SMTP settings and logs." },
      { status: 500 }
    );
  }
}
