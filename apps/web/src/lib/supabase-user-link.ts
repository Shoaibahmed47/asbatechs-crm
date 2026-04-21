import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase";

type CrmUser = {
  id: number;
  email: string;
  supabaseAuthId?: string | null;
};

function isAlreadyRegisteredError(error: unknown) {
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : String(error ?? "");
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";

  const normalized = message.toLowerCase();
  const normalizedCode = code.toLowerCase();

  return (
    normalized.includes("already registered") ||
    normalized.includes("already been registered") ||
    normalized.includes("already exists") ||
    normalized.includes("already associated") ||
    normalizedCode === "email_exists" ||
    normalizedCode === "user_already_exists"
  );
}

export async function linkSupabaseAuthId(userId: number, supabaseAuthId: string) {
  await db
    .update(schema.users)
    .set({
      supabaseAuthId,
      updatedAt: new Date()
    })
    .where(eq(schema.users.id, userId));
}

export async function ensureSupabaseIdentityForLogin(user: CrmUser, password: string) {
  const adminClient = createSupabaseAdminClient();
  const publicClient = createSupabaseServerClient();

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email: user.email,
    password,
    email_confirm: true
  });

  if (!createError && created.user?.id) {
    await linkSupabaseAuthId(user.id, created.user.id);
    return {
      authUserId: created.user.id,
      source: "created" as const
    };
  }

  if (createError && !isAlreadyRegisteredError(createError)) {
    throw createError;
  }

  const { data: signedIn, error: signInError } = await publicClient.auth.signInWithPassword({
    email: user.email,
    password
  });

  if (signInError || !signedIn.user?.id) {
    return null;
  }

  if (!user.supabaseAuthId) {
    await linkSupabaseAuthId(user.id, signedIn.user.id);
  }

  return {
    authUserId: signedIn.user.id,
    source: "existing" as const
  };
}

export async function ensureSupabaseIdentityForRecovery(user: CrmUser) {
  const adminClient = createSupabaseAdminClient();

  const { data, error } = await adminClient.auth.admin.createUser({
    email: user.email,
    password: randomBytes(24).toString("hex"),
    email_confirm: true
  });

  if (!error && data.user?.id) {
    await linkSupabaseAuthId(user.id, data.user.id);
    return { authUserId: data.user.id, created: true as const };
  }

  if (error && !isAlreadyRegisteredError(error)) {
    throw error;
  }

  return { authUserId: user.supabaseAuthId ?? null, created: false as const };
}
