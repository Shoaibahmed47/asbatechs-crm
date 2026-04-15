import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { COOKIE_NAME, normalizeEmail, verifyAuthToken } from "@/lib/auth";
import { isAdminRole } from "@/lib/rbac";
import { sendClientInviteEmail } from "@/lib/mail";

const inviteSchema = z.object({
  email: z.string().email(),
  action: z.enum(["invite", "resend"]).default("invite")
});

export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const payload = token ? await verifyAuthToken(token) : null;

  if (!payload || !isAdminRole(payload.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const email = normalizeEmail(parsed.data.email);
  const action = parsed.data.action;
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";

  const [existingClient] = await db
    .select()
    .from(schema.clients)
    .where(sql`lower(${schema.clients.email}) = ${email}`);
  if (existingClient) {
    return NextResponse.json(
      { error: "This email is already a client", code: "CLIENT_EXISTS" },
      { status: 409 }
    );
  }

  const [existingUser] = await db
    .select()
    .from(schema.users)
    .where(sql`lower(${schema.users.email}) = ${email}`);
  if (existingUser) {
    return NextResponse.json(
      { error: "This email is already used for a team account" },
      { status: 409 }
    );
  }

  const pending = await db
    .select()
    .from(schema.clientInvitations)
    .where(
      and(
        sql`lower(${schema.clientInvitations.email}) = ${email}`,
        isNull(schema.clientInvitations.acceptedAt)
      )
    );

  const existingInvite =
    pending.length > 0 ? pending[pending.length - 1] : null;
  const inviteToken = randomBytes(32).toString("hex");

  if (action === "invite" && existingInvite) {
    return NextResponse.json(
      {
        error: "Invitation already pending for this email",
        code: "INVITE_PENDING",
        canResend: true
      },
      { status: 409 }
    );
  }

  if (action === "resend" && existingInvite) {
    await db
      .update(schema.clientInvitations)
      .set({
        token: inviteToken,
        invitedByUserId: payload.userId
      })
      .where(eq(schema.clientInvitations.id, existingInvite.id));
  } else {
    await db.insert(schema.clientInvitations).values({
      email,
      token: inviteToken,
      invitedByUserId: payload.userId
    });
  }

  const signupUrl = `${appUrl}/client/signup/${inviteToken}`;

  try {
    await sendClientInviteEmail(email, signupUrl);
  } catch (e) {
    console.error("[client-invites] email:", e);
    return NextResponse.json(
      { error: "Invite saved but email failed. Check SMTP or resend later." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    resent: action === "resend"
  });
}
