import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { isRole } from "@/lib/rbac";
import { logActivity } from "@/lib/audit";

const followUpSchema = z.object({
  nextFollowUpDate: z
    .string()
    .regex(/^\\d{4}-\\d{2}-\\d{2}$/)
    .optional()
    .nullable(),
  message: z.string().min(1).optional().nullable()
});

function normalizeType(typeParam: string): "hot" | "sale" | null {
  if (typeParam === "hot") return "hot";
  if (typeParam === "sales" || typeParam === "sale") return "sale";
  return null;
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

  const body = await req.json().catch(() => null);
  const parsed = followUpSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid follow-up data", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const leadRow = (
    await db
      .select()
      .from(schema.leads)
      .where(and(eq(schema.leads.id, id), eq(schema.leads.isDeleted, false)))
  )[0];

  if (!leadRow || leadRow.type !== type) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  if (payload.role === "employee") {
    if (leadRow.assignedUserId !== payload.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }
  if (payload.role === "manager") {
    if (!payload.departmentId || leadRow.departmentId !== payload.departmentId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const nextFollowUpDate =
    parsed.data.nextFollowUpDate === "" ? null : parsed.data.nextFollowUpDate ?? null;

  const [updatedLead] = await db
    .update(schema.leads)
    .set({
      nextFollowUpDate: nextFollowUpDate ?? null
    })
    .where(eq(schema.leads.id, id))
    .returning();

  await logActivity({
    userId: payload.userId,
    action: "lead_follow_up_scheduled",
    entityType: "lead",
    entityId: id
  });

  const recipientUserId = updatedLead.nextFollowUpDate && updatedLead.assignedUserId
    ? updatedLead.assignedUserId
    : updatedLead.assignedUserId ?? payload.userId;

  if (nextFollowUpDate && recipientUserId) {
    await db.insert(schema.notifications).values({
      userId: recipientUserId,
      type: "follow_up_reminder",
      leadId: id,
      dueDate: nextFollowUpDate,
      message:
        parsed.data.message ??
        `Follow up with ${updatedLead.clientName} on ${nextFollowUpDate}.`
    });
  }

  return NextResponse.json({ lead: updatedLead }, { status: 200 });
}

