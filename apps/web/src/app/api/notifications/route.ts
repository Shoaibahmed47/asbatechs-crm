import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { isRole } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const payload = token ? await verifyAuthToken(token) : null;
  if (!payload || !isRole(payload.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const onlyUnread = req.nextUrl.searchParams.get("unread") !== "false";
  const whereClause = onlyUnread
    ? and(
        eq(schema.notifications.userId, payload.userId),
        isNull(schema.notifications.readAt)
      )
    : eq(schema.notifications.userId, payload.userId);

  const notifications = await db
    .select()
    .from(schema.notifications)
    .where(whereClause)
    .orderBy(desc(schema.notifications.createdAt));

  return NextResponse.json({ notifications });
}

const patchSchema = z
  .object({
    notificationId: z.number().int().positive().optional(),
    markAllRead: z.boolean().optional()
  })
  .refine((v) => v.notificationId || v.markAllRead, {
    message: "Provide notificationId or markAllRead=true"
  });

export async function PATCH(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const payload = token ? await verifyAuthToken(token) : null;
  if (!payload || !isRole(payload.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const now = new Date();
  if (parsed.data.markAllRead) {
    await db
      .update(schema.notifications)
      .set({ readAt: now })
      .where(
        and(
          eq(schema.notifications.userId, payload.userId),
          isNull(schema.notifications.readAt)
        )
      );
    return NextResponse.json({ ok: true });
  }

  await db
    .update(schema.notifications)
    .set({ readAt: now })
    .where(
      and(
        eq(schema.notifications.id, parsed.data.notificationId!),
        eq(schema.notifications.userId, payload.userId),
        isNull(schema.notifications.readAt)
      )
    );

  return NextResponse.json({ ok: true });
}

