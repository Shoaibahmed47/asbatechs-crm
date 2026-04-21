import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

function inferSupabaseUrlFromDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return null;

  try {
    const parsed = new URL(databaseUrl);
    const username = decodeURIComponent(parsed.username);
    if (!username.startsWith("postgres.")) return null;
    const projectRef = username.slice("postgres.".length);
    return projectRef ? `https://${projectRef}.supabase.co` : null;
  } catch {
    return null;
  }
}

function getSupabaseUrl() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.SUPABASE_URL ??
    inferSupabaseUrlFromDatabaseUrl()
  );
}

function getSupabasePublishableKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.SUPABASE_ANON_KEY
  );
}

function getSupabaseServiceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY;
}

function requireValue(value: string | null | undefined, message: string) {
  if (!value) {
    throw new Error(message);
  }

  return value;
}

export function createSupabaseBrowserClient() {
  if (browserClient) return browserClient;

  const url = requireValue(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? null,
    "Missing NEXT_PUBLIC_SUPABASE_URL. Add your Supabase project URL to apps/web/.env."
  );
  const key = requireValue(
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      null,
    "Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY in apps/web/.env."
  );

  browserClient = createClient(url, key);
  return browserClient;
}

export function createSupabaseServerClient() {
  const url = requireValue(
    getSupabaseUrl(),
    "Missing Supabase URL. Set NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL."
  );
  const key = requireValue(
    getSupabasePublishableKey(),
    "Missing Supabase publishable key. Set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY."
  );

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

export function createSupabaseAdminClient() {
  const url = requireValue(
    getSupabaseUrl(),
    "Missing Supabase URL. Set NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL."
  );
  const key = requireValue(
    getSupabaseServiceRoleKey(),
    "Missing SUPABASE_SERVICE_ROLE_KEY. Add it to apps/web/.env for invite and password recovery flows."
  );

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}
