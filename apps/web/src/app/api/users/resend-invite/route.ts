import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { isAdminRole } from "@/lib/rbac";
import { sendInviteEmail } from "@/lib/mail";

const bodySchema = z.object({
  email: z.string().email()
});

export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const payload = token ? await verifyAuthToken(token) : null;

  if (!payload || !isAdminRole(payload.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const raw = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const email = parsed.data.email.trim().toLowerCase();

  const [existingUser] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email));

  if (existingUser) {
    return NextResponse.json(
      { error: "This email is already added" },
      { status: 409 }
    );
  }

  const pending = await db
    .select()
    .from(schema.invitations)
    .where(
      and(
        eq(schema.invitations.email, email),
        isNull(schema.invitations.acceptedAt)
      )
    );

  const inviteRow = pending.length > 0 ? pending[pending.length - 1] : null;
  if (!inviteRow) {
    return NextResponse.json(
      { error: "No pending invitation for this email" },
      { status: 404 }
    );
  }

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const inviteToken = randomBytes(32).toString("hex");

  try {
    await db
      .update(schema.invitations)
      .set({
        token: inviteToken,
        invitedByUserId: payload.userId
      })
      .where(eq(schema.invitations.id, inviteRow.id));

    await sendInviteEmail(email, `${appUrl}/employee-signup/${inviteToken}`);

    return NextResponse.json({ success: true, message: "Invitation sent again" });
  } catch (error) {
    console.error("resend-invite:", error);
    return NextResponse.json(
      { error: "Failed to send invitation. Check SMTP settings and logs." },
      { status: 500 }
    );
  }
}
