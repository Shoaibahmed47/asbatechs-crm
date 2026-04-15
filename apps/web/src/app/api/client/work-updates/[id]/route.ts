import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { getClientSession } from "@/lib/client-session";
import { z } from "zod";

const optionalGit = z.string().max(2000).nullable().optional();

const patchSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  notes: z.string().max(8000).nullable().optional(),
  projectId: z.number().int().positive().nullable().optional(),
  gitRepoUrl: optionalGit
});

function emptyToNull(s: string | null | undefined): string | null {
  if (s == null || s === "") return null;
  return s;
}

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

  const [existing] = await db
    .select()
    .from(schema.clientWorkUpdates)
    .where(
      and(
        eq(schema.clientWorkUpdates.id, id),
        eq(schema.clientWorkUpdates.clientId, session.clientId)
      )
    );

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }

  let projectId = existing.projectId;
  if (parsed.data.projectId !== undefined) {
    projectId = parsed.data.projectId;
    if (projectId != null) {
      const [owned] = await db
        .select({ id: schema.clientProjects.id })
        .from(schema.clientProjects)
        .where(
          and(
            eq(schema.clientProjects.id, projectId),
            eq(schema.clientProjects.clientId, session.clientId)
          )
        );
      if (!owned) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
    }
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.title != null) updates.title = parsed.data.title;
  if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes;
  if (parsed.data.projectId !== undefined) updates.projectId = projectId;
  if (parsed.data.gitRepoUrl !== undefined) {
    updates.gitRepoUrl = emptyToNull(parsed.data.gitRepoUrl);
  }

  const [row] = await db
    .update(schema.clientWorkUpdates)
    .set(updates as any)
    .where(eq(schema.clientWorkUpdates.id, id))
    .returning();

  return NextResponse.json({ update: row });
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
    .delete(schema.clientWorkUpdates)
    .where(
      and(
        eq(schema.clientWorkUpdates.id, id),
        eq(schema.clientWorkUpdates.clientId, session.clientId)
      )
    )
    .returning({ id: schema.clientWorkUpdates.id });

  if (deleted.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
