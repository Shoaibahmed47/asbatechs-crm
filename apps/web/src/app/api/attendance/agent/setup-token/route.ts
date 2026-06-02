import { NextRequest, NextResponse } from "next/server";
import {
  COOKIE_NAME,
  signAuthTokenWithExpiry,
  type AuthTokenPayload,
  verifyAuthToken
} from "@/lib/auth";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";

function getBearerToken(req: NextRequest): string | null {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(" ");
  if (!scheme || !token) return null;
  if (scheme.toLowerCase() !== "bearer") return null;
  return token.trim() || null;
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value ?? getBearerToken(req);
  const payload = token ? await verifyAuthToken(token) : null;
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Short-lived setup token so command can be copied safely without exposing password.
  const setupPayload: AuthTokenPayload = {
    userId: payload.userId,
    role: payload.role,
    departmentId: payload.departmentId ?? null
  };
  const setupToken = await signAuthTokenWithExpiry(setupPayload, "30m");
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  await db.insert(schema.activityLogs).values({
    userId: payload.userId,
    action: "agent_setup_prepared",
    entityType: "attendance_agent",
    entityId: 0
  });

  return NextResponse.json({
    token: setupToken,
    expiresAt
  });
}
