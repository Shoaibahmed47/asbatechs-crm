import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import {
  COOKIE_NAME,
  signAuthTokenWithExpiry,
  type AuthTokenPayload,
  verifyAuthToken
} from "@/lib/auth";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";

export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const payload = token ? await verifyAuthToken(token) : null;
  if (!payload || payload.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { userId?: number } = {};
  try {
    body = (await req.json()) as { userId?: number };
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const userId = Number(body.userId);
  if (!Number.isFinite(userId)) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const [user] = await db
    .select({
      id: schema.users.id,
      role: schema.users.role,
      departmentId: schema.users.departmentId
    })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const setupPayload: AuthTokenPayload = {
    userId: user.id,
    role: user.role,
    departmentId: user.departmentId ?? null
  };
  const setupToken = await signAuthTokenWithExpiry(setupPayload, "30m");
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  await db.insert(schema.activityLogs).values({
    userId: user.id,
    action: "agent_setup_prepared",
    entityType: "attendance_agent",
    entityId: 0
  });

  return NextResponse.json({ token: setupToken, expiresAt });
}
