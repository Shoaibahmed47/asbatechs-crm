import { NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import {
  COOKIE_NAME,
  findUserByEmail,
  hashPassword,
  signAuthToken,
  verifyPassword
} from "@/lib/auth";
import { ensureDefaultAdmin } from "@/lib/bootstrap-admin";
import { createSupabaseServerClient } from "@/lib/supabase";
import { ensureSupabaseIdentityForLogin, linkSupabaseAuthId } from "@/lib/supabase-user-link";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

function isDatabaseConnectionError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const code =
    err && typeof err === "object" && "code" in err
      ? String((err as { code?: string }).code)
      : "";
  return (
    code === "ECONNREFUSED" ||
    code === "ENOTFOUND" ||
    code === "28P01" ||
    msg.includes("ECONNREFUSED") ||
    msg.includes("getaddrinfo") ||
    msg.includes("password authentication failed")
  );
}

function isMissingRelationError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("does not exist") && msg.includes("relation");
}

async function authenticateWithSupabase(email: string, password: string) {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return { authenticated: false as const, reason: "rejected" as const, detail: error.message };
    }

    return {
      authenticated: true as const,
      email: data.user.email ?? email,
      authUserId: data.user.id
    };
  } catch (error) {
    return {
      authenticated: false as const,
      reason: "unavailable" as const,
      detail: error instanceof Error ? error.message : String(error)
    };
  }
}

function buildRecoveredUserName(email: string) {
  const prefix = email.split("@")[0]?.trim();
  return prefix || email;
}

async function recoverInvitedEmployeeFromSupabaseIdentity(params: {
  email: string;
  authUserId: string;
}) {
  const { email, authUserId } = params;
  const [invite] = await db
    .select()
    .from(schema.invitations)
    .where(
      and(
        sql`lower(${schema.invitations.email}) = ${email}`,
        isNull(schema.invitations.acceptedAt)
      )
    )
    .orderBy(desc(schema.invitations.id))
    .limit(1);

  if (!invite) return null;

  const passwordHash = await hashPassword(randomBytes(32).toString("hex"));
  const [createdUser] = await db
    .insert(schema.users)
    .values({
      name: buildRecoveredUserName(email),
      email,
      supabaseAuthId: authUserId,
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

  return createdUser;
}

export async function POST(req: Request) {
  try {
    await ensureDefaultAdmin();

    const body = await req.json().catch(() => null);
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid credentials payload" },
        { status: 400 }
      );
    }

    const email = parsed.data.email.trim().toLowerCase();
    const { password } = parsed.data;
    const supabaseResult = await authenticateWithSupabase(email, password);
    let user = await findUserByEmail(email);

    if (supabaseResult.authenticated && !user) {
      const recoveredUser = await recoverInvitedEmployeeFromSupabaseIdentity({
        email,
        authUserId: supabaseResult.authUserId
      });

      if (!recoveredUser) {
        return NextResponse.json(
          { error: "This Supabase account is not linked to a CRM staff profile yet." },
          { status: 403 }
        );
      }

      user = recoveredUser;
    }

    if (!user) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    if (supabaseResult.authenticated) {
      if (user.supabaseAuthId && user.supabaseAuthId !== supabaseResult.authUserId) {
        return NextResponse.json(
          { error: "This CRM account is linked to a different Supabase identity." },
          { status: 403 }
        );
      }

      if (!user.supabaseAuthId) {
        await linkSupabaseAuthId(user.id, supabaseResult.authUserId);
      }
    } else {
      const ok = await verifyPassword(password, user.passwordHash);
      if (!ok) {
        return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
      }

      const linked = await ensureSupabaseIdentityForLogin(
        {
          id: user.id,
          email: user.email,
          supabaseAuthId: user.supabaseAuthId
        },
        password
      );

      if (!linked) {
        return NextResponse.json(
          {
            error:
              "This account exists in the CRM, but Supabase rejected the sign-in. Use Forgot password to finish the migration."
          },
          { status: 401 }
        );
      }
    }

    const token = await signAuthToken({
      userId: user.id,
      role: user.role,
      departmentId: user.departmentId
    });

    try {
      await db.insert(schema.activityLogs).values({
        userId: user.id,
        action: "login",
        entityType: "user",
        entityId: user.id
      });
    } catch (logErr) {
      console.error("[auth/login] activity_logs insert failed (sign-in still succeeds)", logErr);
    }

    const res = NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        departmentId: user.departmentId
      }
    });

    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/"
    });

    return res;
  } catch (err) {
    console.error("[auth/login]", err);
    const detail = err instanceof Error ? err.message : String(err);

    if (isDatabaseConnectionError(err)) {
      return NextResponse.json(
        {
          error:
            "Cannot connect to PostgreSQL. Start the database service and set DATABASE_URL in apps/web/.env (see terminal for details).",
          ...(process.env.NODE_ENV === "development" ? { detail } : {})
        },
        { status: 503 }
      );
    }

    if (isMissingRelationError(err)) {
      return NextResponse.json(
        {
          error:
            "Database is reachable but tables are missing. From the project root run: npm run db:migrate",
          ...(process.env.NODE_ENV === "development" ? { detail } : {})
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        error: "Sign-in failed due to a server error.",
        ...(process.env.NODE_ENV === "development" ? { detail } : {})
      },
      { status: 500 }
    );
  }
}
