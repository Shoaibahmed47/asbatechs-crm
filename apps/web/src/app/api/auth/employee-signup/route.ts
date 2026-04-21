import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { hashPassword, normalizeEmail } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase";

const legacySignupSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8)
});

const supabaseSignupSchema = z.object({
  accessToken: z.string().min(1)
});

function buildInviteDisplayName(email: string, metadata?: Record<string, unknown>) {
  const firstName =
    typeof metadata?.firstName === "string" ? metadata.firstName.trim() : "";
  const lastName =
    typeof metadata?.lastName === "string" ? metadata.lastName.trim() : "";
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();

  if (fullName) return fullName;

  const prefix = email.split("@")[0]?.trim();
  return prefix || email;
}

async function completeLegacySignup(token: string, password: string) {
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

async function completeSupabaseInvite(accessToken: string) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser(accessToken);

  if (error || !user?.email) {
    return NextResponse.json(
      { error: "Invalid or expired invitation session" },
      { status: 401 }
    );
  }

  const email = normalizeEmail(user.email);

  const pendingInvites = await db
    .select()
    .from(schema.invitations)
    .where(
      and(
        sql`lower(${schema.invitations.email}) = ${email}`,
        isNull(schema.invitations.acceptedAt)
      )
    );

  const invite =
    pendingInvites.length > 0 ? pendingInvites[pendingInvites.length - 1] : null;

  const [existingUser] = await db
    .select()
    .from(schema.users)
    .where(sql`lower(${schema.users.email}) = ${email}`);

  if (existingUser) {
    if (invite) {
      await db
        .update(schema.invitations)
        .set({ acceptedAt: new Date() })
        .where(eq(schema.invitations.id, invite.id));
    }

    return NextResponse.json({
      user: {
        id: existingUser.id,
        email: existingUser.email,
        role: existingUser.role
      }
    });
  }

  if (!invite) {
    return NextResponse.json(
      { error: "Invitation not found or already completed" },
      { status: 400 }
    );
  }

  const passwordHash = await hashPassword(randomBytes(32).toString("hex"));
  const [userRow] = await db
    .insert(schema.users)
    .values({
      name: buildInviteDisplayName(email, user.user_metadata as Record<string, unknown>),
      email,
      supabaseAuthId: user.id,
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
      id: userRow.id,
      email: userRow.email,
      role: userRow.role
    }
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  const supabaseParsed = supabaseSignupSchema.safeParse(body);
  if (supabaseParsed.success) {
    return completeSupabaseInvite(supabaseParsed.data.accessToken);
  }

  const legacyParsed = legacySignupSchema.safeParse(body);
  if (!legacyParsed.success) {
    return NextResponse.json({ error: "Invalid signup data" }, { status: 400 });
  }

  return completeLegacySignup(legacyParsed.data.token.trim(), legacyParsed.data.password);
}
