import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase";
import { findUserByEmail, normalizeEmail } from "@/lib/auth";
import { ensureSupabaseIdentityForRecovery } from "@/lib/supabase-user-link";

const bodySchema = z.object({
  email: z.string().email()
});

export async function POST(req: Request) {
  const raw = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(raw);

  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const email = normalizeEmail(parsed.data.email);
  const user = await findUserByEmail(email);

  try {
    const publicClient = createSupabaseServerClient();
    if (user) {
      await ensureSupabaseIdentityForRecovery({
        id: user.id,
        email: user.email,
        supabaseAuthId: user.supabaseAuthId
      });
    }

    const appUrl = process.env.APP_URL ?? "http://localhost:3000";
    const { error } = await publicClient.auth.resetPasswordForEmail(email, {
      redirectTo: `${appUrl}/reset-password`
    });

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[auth/forgot-password]", error);
    const detail = error instanceof Error ? error.message : String(error);

    return NextResponse.json(
      {
        error: "Password recovery is not ready yet. Check Supabase URL, publishable key, service role key, and Auth email settings.",
        ...(process.env.NODE_ENV === "development" ? { detail } : {})
      },
      { status: 503 }
    );
  }
}
