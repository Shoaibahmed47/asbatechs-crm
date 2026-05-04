import type { NextRequest } from "next/server";

/**
 * Resolve app base URL from request in a way that supports both local and production.
 * - In local/dev, prefer the incoming request host (localhost).
 * - In production, prefer APP_URL if configured.
 */
export function resolveAppUrl(req: NextRequest): string {
  const inviteBaseUrl = process.env.INVITE_BASE_URL?.trim();
  if (inviteBaseUrl) {
    return inviteBaseUrl;
  }

  const configuredAppUrl = process.env.APP_URL?.trim();

  const forwardedHostRaw = req.headers.get("x-forwarded-host");
  const forwardedProtoRaw = req.headers.get("x-forwarded-proto");
  const hostRaw = forwardedHostRaw || req.headers.get("host");

  const host = hostRaw?.split(",")[0]?.trim();
  const protoHint = forwardedProtoRaw?.split(",")[0]?.trim();

  let inferredUrl: string | null = null;
  if (host) {
    const proto =
      protoHint ||
      (host.startsWith("localhost") || host.startsWith("127.0.0.1")
        ? "http"
        : "https");
    inferredUrl = `${proto}://${host}`;
  }

  const isLocalHost =
    host?.startsWith("localhost") || host?.startsWith("127.0.0.1");

  // Always prefer request origin for localhost so local testing works
  // even when running a production build (`npm start`).
  if (isLocalHost && inferredUrl) {
    return inferredUrl;
  }

  if (process.env.NODE_ENV !== "production" && inferredUrl) {
    return inferredUrl;
  }

  return configuredAppUrl || inferredUrl || "http://localhost:3000";
}

