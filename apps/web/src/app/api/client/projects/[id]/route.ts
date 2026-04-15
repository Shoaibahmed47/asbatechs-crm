import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { getClientSession } from "@/lib/client-session";
import { z } from "zod";

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional()
});

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const session = await getClientSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = Number((await ctx.params).id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Bad id" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }

  const [existing] = await db
    .select({ id: schema.clientProjects.id })
    .from(schema.clientProjects)
    .where(
      and(
        eq(schema.clientProjects.id, id),
        eq(schema.clientProjects.clientId, session.clientId)
      )
    );

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.name != null) updates.name = parsed.data.name;
  if (parsed.data.description !== undefined) {
    updates.description = parsed.data.description;
  }

  const [row] = await db
    .update(schema.clientProjects)
    .set(updates as any)
    .where(eq(schema.clientProjects.id, id))
    .returning();

  return NextResponse.json({ project: row });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const session = await getClientSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = Number((await ctx.params).id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Bad id" }, { status: 400 });
  }

  const deleted = await db
    .delete(schema.clientProjects)
    .where(
      and(
        eq(schema.clientProjects.id, id),
        eq(schema.clientProjects.clientId, session.clientId)
      )
    )
    .returning({ id: schema.clientProjects.id });

  if (deleted.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
