import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { sendInviteEmail } from "@/lib/mail";

const inviteSchema = z.object({
  email: z.string().email(),
  departmentId: z.number().nullable().optional(),
  action: z.enum(["invite", "resend"]).default("invite")
});

export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const payload = token ? await verifyAuthToken(token) : null;

  if (!payload || payload.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = inviteSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const email = parsed.data.email.trim().toLowerCase();
  const departmentId = parsed.data.departmentId ?? null;
  const action = parsed.data.action;

  try {
    const [existingUser] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email));

    if (existingUser) {
      return NextResponse.json(
        { error: "This email is already added", code: "EMAIL_ALREADY_ADDED" },
        { status: 409 }
      );
    }

    const existingInvites = await db
      .select()
      .from(schema.invitations)
      .where(
        and(
          eq(schema.invitations.email, email),
          isNull(schema.invitations.acceptedAt)
        )
      );

    const existingInvite =
      existingInvites.length > 0 ? existingInvites[existingInvites.length - 1] : null;

    const appUrl = process.env.APP_URL ?? "http://localhost:3000";
    const inviteToken = randomBytes(32).toString("hex");

    if (action === "invite" && existingInvite) {
      return NextResponse.json(
        {
          error: "This email is already added",
          code: "EMAIL_ALREADY_ADDED",
          canResend: true
        },
        { status: 409 }
      );
    }

    if (action === "resend" && existingInvite) {
      await db
        .update(schema.invitations)
        .set({
          departmentId,
          token: inviteToken,
          invitedByUserId: payload.userId,
          acceptedAt: null
        })
        .where(eq(schema.invitations.id, existingInvite.id));
    } else {
      await db.insert(schema.invitations).values({
        email,
        departmentId,
        token: inviteToken,
        invitedByUserId: payload.userId
      });
    }

    const signupUrl = `${appUrl}/employee-signup/${inviteToken}`;

    await sendInviteEmail(email, signupUrl);

    return NextResponse.json({
      success: true,
      resent: action === "resend"
    });
  } catch (error: any) {
    console.error("Failed to send invitation:", error);
    return NextResponse.json(
      { error: "Failed to send invitation. Check SMTP settings and logs." },
      { status: 500 }
    );
  }
}

