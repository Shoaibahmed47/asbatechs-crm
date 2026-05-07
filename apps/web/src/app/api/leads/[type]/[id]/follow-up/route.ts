import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { isRole } from "@/lib/rbac";
import { logActivity } from "@/lib/audit";
import { upsertLeadFollowUpReminder } from "@/lib/lead-follow-up-reminder";
import {
  buildFollowUpUtcIso,
  isDateOnly,
  isValidTimeZone
} from "@/lib/follow-up-time";

const followUpSchema = z.object({
  nextFollowUpAtLocal: z.string().optional().nullable(),
  followUpTimezone: z.string().optional().nullable(),
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

  if (payload.role === "manager") {
    if (!payload.departmentId || leadRow.departmentId !== payload.departmentId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  let nextFollowUpAt: Date | null = null;
  let nextFollowUpDate: string | null = null;
  let followUpTimezone: string | null = null;

  if (parsed.data.nextFollowUpAtLocal) {
    if (
      !parsed.data.followUpTimezone ||
      !isValidTimeZone(parsed.data.followUpTimezone)
    ) {
      return NextResponse.json(
        { error: "Pick a valid follow-up timezone." },
        { status: 400 }
      );
    }
    try {
      const utcIso = buildFollowUpUtcIso({
        localDateTime: parsed.data.nextFollowUpAtLocal,
        timeZone: parsed.data.followUpTimezone
      });
      nextFollowUpAt = new Date(utcIso);
      nextFollowUpDate = utcIso.slice(0, 10);
      followUpTimezone = parsed.data.followUpTimezone;
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Invalid follow-up date and time."
        },
        { status: 400 }
      );
    }
  } else {
    const fallbackDate = parsed.data.nextFollowUpDate;
    if (fallbackDate) {
      if (!isDateOnly(fallbackDate)) {
        return NextResponse.json(
          { error: "Follow-up date must be in YYYY-MM-DD format." },
          { status: 400 }
        );
      }
      nextFollowUpDate = fallbackDate;
    }
  }

  const [updatedLead] = await db
    .update(schema.leads)
    .set({
      nextFollowUpAt: nextFollowUpAt ?? null,
      nextFollowUpDate: nextFollowUpDate ?? null,
      followUpTimezone
    })
    .where(eq(schema.leads.id, id))
    .returning();

  await logActivity({
    userId: payload.userId,
    action: "lead_follow_up_scheduled",
    entityType: "lead",
    entityId: id
  });

  const recipientUserId = updatedLead.assignedUserId ?? payload.userId;
  if (recipientUserId) {
    await upsertLeadFollowUpReminder({
      userId: recipientUserId,
      leadId: id,
      clientName: updatedLead.clientName,
      nextFollowUpAt: updatedLead.nextFollowUpAt,
      nextFollowUpDate: updatedLead.nextFollowUpDate,
      message: parsed.data.message
    });
  }

  return NextResponse.json({ lead: updatedLead }, { status: 200 });
}

