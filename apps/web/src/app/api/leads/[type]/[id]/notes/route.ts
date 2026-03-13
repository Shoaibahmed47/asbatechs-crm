import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { COOKIE_NAME, verifyAuthToken } from "@/lib/auth";

const noteSchema = z.object({
  content: z.string().min(1)
});

export async function GET(
  _req: NextRequest,
  { params }: { params: { type: string; id: string } }
) {
  const id = Number(params.id);
  const type = params.type === "sales" ? "sale" : "hot";
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const notes = await db
    .select()
    .from(schema.leadNotes)
    .where(
      and(
        eq(schema.leadNotes.leadId, id),
        eq(schema.leadNotes.leadType, type)
      )
    )
    .orderBy(schema.leadNotes.createdAt);

  return NextResponse.json({ notes });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { type: string; id: string } }
) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const payload = token ? await verifyAuthToken(token) : null;
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = Number(params.id);
  const type = params.type === "sales" ? "sale" : "hot";
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = noteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid note data", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const [note] = await db
    .insert(schema.leadNotes)
    .values({
      leadId: id,
      leadType: type,
      authorUserId: payload.userId,
      content: parsed.data.content
    })
    .returning();

  return NextResponse.json({ note }, { status: 201 });
}

