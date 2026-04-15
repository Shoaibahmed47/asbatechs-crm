import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { findUserByEmail, verifyPassword, signAuthToken, COOKIE_NAME } from "@/lib/auth";
import { ensureDefaultAdmin } from "@/lib/bootstrap-admin";

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

    const { email, password } = parsed.data;
    const user = await findUserByEmail(email);

    if (!user) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
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

