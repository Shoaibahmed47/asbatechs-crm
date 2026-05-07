import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { isRole } from "@/lib/rbac";

const noteBodySchema = z
  .object({
    note: z.string().min(1).optional(),
    content: z.string().min(1).optional()
  })
  .refine((d) => Boolean((d.note ?? d.content ?? "").trim()), {
    message: "Provide note (or legacy content)"
  });

function normalizeType(typeParam: string): "hot" | "sale" | null {
  if (typeParam === "hot") return "hot";
  if (typeParam === "sales" || typeParam === "sale") return "sale";
  return null;
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ type: string; id: string }> }
) {
  const req = _req;
  const { id: idParam, type: typeParam } = await context.params;
  const id = Number(idParam);
  const type = normalizeType(typeParam);
  if (Number.isNaN(id) || !type) {
    return NextResponse.json({ error: "Invalid id or type" }, { status: 400 });
  }

  const token = req.cookies.get(COOKIE_NAME)?.value;
  const payload = token ? await verifyAuthToken(token) : null;
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isRole(payload.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [leadRow] = await db
    .select()
    .from(schema.leads)
    .where(and(eq(schema.leads.id, id), eq(schema.leads.isDeleted, false)));

  if (!leadRow || leadRow.type !== type) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  if (payload.role === "manager") {
    if (!payload.departmentId || leadRow.departmentId !== payload.departmentId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const notes = await db
    .select()
    .from(schema.leadNotes)
    .where(eq(schema.leadNotes.leadId, id))
    .orderBy(asc(schema.leadNotes.createdAt));

  return NextResponse.json({ notes });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ type: string; id: string }> }
) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const payload = token ? await verifyAuthToken(token) : null;
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isRole(payload.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: idParam, type: typeParam } = await context.params;
  const id = Number(idParam);
  const type = normalizeType(typeParam);
  if (Number.isNaN(id) || !type) {
    return NextResponse.json({ error: "Invalid id or type" }, { status: 400 });
  }

  const [leadRow] = await db
    .select()
    .from(schema.leads)
    .where(and(eq(schema.leads.id, id), eq(schema.leads.isDeleted, false)));

  if (!leadRow || leadRow.type !== type) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  if (payload.role === "manager") {
    if (!payload.departmentId || leadRow.departmentId !== payload.departmentId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const body = await req.json().catch(() => null);
  const parsed = noteBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid note data", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const noteText = (parsed.data.note ?? parsed.data.content ?? "").trim();

  const [note] = await db
    .insert(schema.leadNotes)
    .values({
      leadId: id,
      userId: payload.userId,
      note: noteText
    })
    .returning();

  await db.insert(schema.activityLogs).values({
    userId: payload.userId,
    action: "lead_note_created",
    entityType: "lead",
    entityId: id
  });

  return NextResponse.json({ note }, { status: 201 });
}
