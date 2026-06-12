import type { NextRequest } from "next/server";
import { COOKIE_NAME, verifyAuthToken, type AuthTokenPayload } from "@/lib/auth";

export function getBearerToken(req: NextRequest): string | null {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(" ");
  if (!scheme || !token) return null;
  if (scheme.toLowerCase() !== "bearer") return null;
  return token.trim() || null;
}

/** Resolve staff JWT from HttpOnly cookie or Authorization bearer (desktop agent). */
export async function resolveStaffAuth(req: NextRequest): Promise<AuthTokenPayload | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value ?? getBearerToken(req);
  if (!token) return null;
  return verifyAuthToken(token);
}
