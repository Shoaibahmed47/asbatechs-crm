import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { getClientSession } from "@/lib/client-session";

const reviewSchema = z.object({
  status: z.enum(["in_review", "changes_requested", "approved"]),
  comment: z.string().trim().max(4000).optional()
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

  const [existing] = await db
    .select({ id: schema.clientWorkUpdates.id })
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
  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid review data" }, { status: 400 });
  }

  const [updated] = await db
    .update(schema.clientWorkUpdates)
    .set({
      status: parsed.data.status,
      reviewedAt: new Date(),
      updatedAt: new Date()
    })
    .where(eq(schema.clientWorkUpdates.id, id))
    .returning();

  const comment = parsed.data.comment?.trim();
  if (comment) {
    await db.insert(schema.clientWorkComments).values({
      workUpdateId: id,
      actorType: "client",
      actorClientId: session.clientId,
      body: comment
    });
  }

  return NextResponse.json({ update: updated });
}
