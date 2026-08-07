import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { findUserByEmail, normalizeEmail } from "@/lib/auth";
import { sendPasswordResetEmail } from "@/lib/mail";
import { createSupabaseServerClient } from "@/lib/supabase";
import { ensureSupabaseIdentityForRecovery } from "@/lib/supabase-user-link";

const bodySchema = z.object({
  email: z.string().email()
});

function resolveAppUrl(req: Request): string {
  const fromEnv =
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.CRM_APP_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  try {
    return new URL(req.url).origin;
  } catch {
    return "http://localhost:3000";
  }
}

async function sendCrmResetLink(params: {
  userId: number;
  email: string;
  appUrl: string;
}) {
  const resetToken = randomBytes(32).toString("hex");
  const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000);

  await db
    .update(schema.users)
    .set({
      resetToken,
      resetTokenExpiry,
      updatedAt: new Date()
    })
    .where(eq(schema.users.id, params.userId));

  await sendPasswordResetEmail(
    params.email,
    `${params.appUrl}/reset-password/${resetToken}`
  );
}

async function trySupabaseReset(email: string, appUrl: string): Promise<boolean> {
  try {
    const user = await findUserByEmail(email);
    if (user) {
      await ensureSupabaseIdentityForRecovery({
        id: user.id,
        email: user.email,
        supabaseAuthId: user.supabaseAuthId
      });
    }

    const publicClient = createSupabaseServerClient();
    const { error } = await publicClient.auth.resetPasswordForEmail(email, {
      redirectTo: `${appUrl}/reset-password`
    });
    return !error;
  } catch (error) {
    console.warn("[auth/forgot-password] Supabase reset unavailable", error);
    return false;
  }
}

export async function POST(req: Request) {
  const raw = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(raw);

  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const email = normalizeEmail(parsed.data.email);
  const user = await findUserByEmail(email);
  const appUrl = resolveAppUrl(req);

  // Always return the same success shape when the email is unknown (no user enumeration).
  if (!user) {
    return NextResponse.json({ success: true });
  }

  // Prefer CRM token + SMTP so employees can recover without working Supabase Auth keys.
  try {
    await sendCrmResetLink({
      userId: user.id,
      email: user.email,
      appUrl
    });
    return NextResponse.json({ success: true, via: "crm" });
  } catch (crmError) {
    console.error("[auth/forgot-password] CRM/SMTP reset failed", crmError);
  }

  const supabaseOk = await trySupabaseReset(email, appUrl);
  if (supabaseOk) {
    return NextResponse.json({ success: true, via: "supabase" });
  }

  return NextResponse.json(
    {
      error:
        "Password recovery is not ready yet. Ask an admin to reset your password, or configure SMTP / Supabase Auth email on the server."
    },
    { status: 503 }
  );
}
