import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { assignableUserRoles, isRole } from "@/lib/rbac";
import { autoAssignLead } from "@/lib/lead-assignment";
import { logActivity } from "@/lib/audit";
import { LEAD_STAGE_OPTIONS } from "@/lib/lead-workflow";
import { leadValidationUserMessage } from "@/lib/lead-api-errors";

const emptyToUndef = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

const updateHotLeadSchema = z.object({
  clientName: z.string().min(1, "Enter the client or company name."),
  phone: z.preprocess(
    emptyToUndef,
    z.union([
      z.undefined(),
      z
        .string()
        .min(7, "Enter a valid phone number (at least 7 digits).")
        .max(40, "Phone number is too long.")
        .regex(
          /^[\d\s+().-]+$/,
          "Phone can only include digits, spaces, and these symbols: + - ( )."
        )
    ])
  ),
  email: z.preprocess(
    emptyToUndef,
    z.string().email({ message: "Enter a valid email address (example: name@company.com)." }).optional()
  ),
  source: z.preprocess(emptyToUndef, z.string().optional()),
  departmentId: z.union([z.number().int(), z.null()]).optional(),
  assignedUserId: z.union([z.number().int(), z.null()]).optional(),
  status: z.enum(LEAD_STAGE_OPTIONS).optional(),
  notes: z.preprocess(emptyToUndef, z.string().optional())
});

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const payload = token ? await verifyAuthToken(token) : null;
  if (!payload || !isRole(payload.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: idParam } = await context.params;
  const id = Number(idParam);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Invalid lead id" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = updateHotLeadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: leadValidationUserMessage(parsed.error),
        details: parsed.error.flatten()
      },
      { status: 400 }
    );
  }
  const data = parsed.data;

  const [existingLead] = await db
    .select()
    .from(schema.leads)
    .where(
      and(
        eq(schema.leads.id, id),
        eq(schema.leads.type, "hot"),
        eq(schema.leads.isDeleted, false)
      )
    );

  if (!existingLead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  if (payload.role === "employee" && existingLead.assignedUserId !== payload.userId) {
    return NextResponse.json(
      { error: "You can only edit leads that are assigned to you." },
      { status: 403 }
    );
  }
  if (
    payload.role === "manager" &&
    (!payload.departmentId || existingLead.departmentId !== payload.departmentId)
  ) {
    return NextResponse.json(
      { error: "You can only edit leads that belong to your department." },
      { status: 403 }
    );
  }

  const effectiveDepartmentId = data.departmentId ?? payload.departmentId ?? null;
  if (payload.role !== "admin") {
    if (!payload.departmentId) {
      return NextResponse.json(
        {
          error:
            "Your profile has no department. An admin must assign you to a department before you can update leads."
        },
        { status: 403 }
      );
    }
    if (effectiveDepartmentId !== payload.departmentId) {
      return NextResponse.json(
        { error: "You can only save this lead under your own department." },
        { status: 403 }
      );
    }
  }

  let assignedUserId: number | null = null;
  if (data.assignedUserId == null) {
    assignedUserId = await autoAssignLead({
      leadType: "hot",
      departmentId: effectiveDepartmentId,
      eligibleRoles: assignableUserRoles
    });
    if (assignedUserId == null && payload.role !== "admin") {
      assignedUserId = payload.userId;
    }
  } else if (payload.role === "employee") {
    if (data.assignedUserId !== payload.userId) {
      return NextResponse.json(
        { error: "You can only assign this lead to yourself, or leave “Assigned user” empty for auto-assign." },
        { status: 403 }
      );
    }
    assignedUserId = data.assignedUserId;
  } else if (payload.role === "manager") {
    const [targetUser] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(
        and(
          eq(schema.users.id, data.assignedUserId),
          eq(schema.users.departmentId, payload.departmentId!)
        )
      );
    if (!targetUser) {
      return NextResponse.json(
        { error: "You can only assign leads to people in your own department." },
        { status: 403 }
      );
    }
    assignedUserId = data.assignedUserId;
  } else {
    assignedUserId = data.assignedUserId;
  }

  const [lead] = await db
    .update(schema.leads)
    .set({
      clientName: data.clientName,
      phone: data.phone ?? null,
      email: data.email ?? null,
      source: data.source ?? null,
      departmentId: effectiveDepartmentId,
      assignedUserId,
      status: data.status ?? existingLead.status,
      notesSummary: data.notes ?? null,
      updatedAt: new Date()
    })
    .where(eq(schema.leads.id, id))
    .returning();

  await logActivity({
    userId: payload.userId,
    action: "lead_updated",
    entityType: "lead",
    entityId: id
  });

  if (lead.assignedUserId && lead.assignedUserId !== existingLead.assignedUserId) {
    await db.insert(schema.notifications).values({
      userId: lead.assignedUserId,
      type: "lead_assigned",
      leadId: lead.id,
      message: `You have been assigned an updated hot lead: ${lead.clientName}`
    });
  }

  return NextResponse.json({ lead }, { status: 200 });
}

