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

const updateSaleLeadSchema = z.object({
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
    z
      .string()
      .email({ message: "Enter a valid email address (example: name@company.com)." })
      .optional()
  ),
  source: z.preprocess(emptyToUndef, z.string().optional()),
  departmentId: z.union([z.number().int(), z.null()]).optional(),
  assignedUserId: z.union([z.number().int(), z.null()]).optional(),
  saleAmount: z
    .number({ invalid_type_error: "Sale amount must be a number." })
    .nonnegative("Sale amount cannot be negative.")
    .optional(),
  servicePurchased: z.preprocess(emptyToUndef, z.string().optional()),
  notes: z.preprocess(emptyToUndef, z.string().optional()),
  saleDate: z.preprocess(emptyToUndef, z.string().optional()),
  status: z.enum(LEAD_STAGE_OPTIONS).optional()
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
  const parsed = updateSaleLeadSchema.safeParse(body);
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
        eq(schema.leads.type, "sale"),
        eq(schema.leads.isDeleted, false)
      )
    );
  if (!existingLead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const [currentUser] = await db
    .select({
      id: schema.users.id,
      departmentId: schema.users.departmentId
    })
    .from(schema.users)
    .where(eq(schema.users.id, payload.userId));
  const currentDepartmentId = currentUser?.departmentId ?? null;

  if (
    payload.role === "manager" &&
    (!currentDepartmentId || existingLead.departmentId !== currentDepartmentId)
  ) {
    return NextResponse.json(
      { error: "You can only edit leads that belong to your department." },
      { status: 403 }
    );
  }

  if (payload.role === "manager") {
    if (!currentDepartmentId) {
      return NextResponse.json(
        {
          error:
            "Your profile has no department. An admin must assign you to a department before you can update sales leads."
        },
        { status: 403 }
      );
    }
    if (data.departmentId != null && data.departmentId !== currentDepartmentId) {
      return NextResponse.json(
        { error: "You can only save this lead under your own department." },
        { status: 403 }
      );
    }
  }

  let assignedUserId: number | null = null;
  if (data.assignedUserId == null) {
    assignedUserId = await autoAssignLead({
      leadType: "sale",
      departmentId: currentDepartmentId ?? existingLead.departmentId ?? null,
      eligibleRoles: assignableUserRoles
    });
    if (assignedUserId == null && payload.role !== "admin") {
      assignedUserId = payload.userId;
    }
  } else if (payload.role === "employee") {
    assignedUserId = data.assignedUserId;
  } else if (payload.role === "manager") {
    const [targetUser] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(
        and(
          eq(schema.users.id, data.assignedUserId),
          eq(schema.users.departmentId, currentDepartmentId!)
        )
      );
    if (!targetUser) {
      return NextResponse.json(
        { error: "You can only assign sales leads to people in your own department." },
        { status: 403 }
      );
    }
    assignedUserId = data.assignedUserId;
  } else {
    assignedUserId = data.assignedUserId;
  }

  let effectiveDepartmentId: number | null = currentDepartmentId ?? existingLead.departmentId;
  if (assignedUserId != null) {
    const [assignee] = await db
      .select({ departmentId: schema.users.departmentId })
      .from(schema.users)
      .where(eq(schema.users.id, assignedUserId));
    if (!assignee) {
      return NextResponse.json({ error: "Assigned user not found." }, { status: 400 });
    }
    effectiveDepartmentId = assignee.departmentId ?? null;
  } else {
    effectiveDepartmentId = null;
  }

  const saleDateStr =
    data.saleDate && /^\d{4}-\d{2}-\d{2}$/.test(data.saleDate)
      ? data.saleDate
      : null;
  const amountStr = data.saleAmount != null ? data.saleAmount.toFixed(2) : null;

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
      saleAmount: amountStr,
      servicePurchased: data.servicePurchased ?? null,
      saleDate: saleDateStr as any,
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
      message: `You have been assigned an updated sales lead: ${lead.clientName}`
    });
  }

  return NextResponse.json({ lead }, { status: 200 });
}

