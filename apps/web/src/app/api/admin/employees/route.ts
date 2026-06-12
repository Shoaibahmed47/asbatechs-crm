import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { sendEmployeeInvite } from "@/lib/supabase-employee-invite";
import { resolveAppUrl } from "@/lib/request-origin";

const inviteSchema = z.object({
  email: z.string().email(),
  firstName: z.string().trim().optional(),
  lastName: z.string().trim().optional(),
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
  const firstName = parsed.data.firstName?.trim() || undefined;
  const lastName = parsed.data.lastName?.trim() || undefined;
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

    const appUrl = resolveAppUrl(req);
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

    const inviteResult = await sendEmployeeInvite({
      email,
      redirectTo: `${appUrl}/employee-signup`,
      invitationToken: inviteToken,
      resend: action === "resend",
      metadata: {
        firstName,
        lastName,
        departmentId,
        invitedByUserId: payload.userId
      }
    });

    return NextResponse.json({
      success: true,
      resent: action === "resend",
      delivery: inviteResult.delivery
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "Unknown error";
    console.error("Failed to send invitation:", error);
    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "production"
            ? "Failed to send invitation. Check Supabase Auth settings, redirect URLs, service role key, and SMTP fallback."
            : `Failed to send invitation: ${message}`
      },
      { status: 500 }
    );
  }
}
