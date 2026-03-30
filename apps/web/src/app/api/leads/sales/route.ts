import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { getLocalDateString } from "@/lib/attendance-date";
import { assignableUserRoles, isRole } from "@/lib/rbac";
import { autoAssignLead } from "@/lib/lead-assignment";
import { logActivity } from "@/lib/audit";

const emptyToUndef = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

const createSaleLeadSchema = z.object({
  clientName: z.string().min(1),
  phone: z.preprocess(emptyToUndef, z.string().optional()),
  email: z.preprocess(emptyToUndef, z.string().email().optional()),
  departmentId: z.union([z.number().int(), z.null()]).optional(),
  assignedUserId: z.union([z.number().int(), z.null()]).optional(),
  saleAmount: z.number().nonnegative().optional(),
  servicePurchased: z.preprocess(emptyToUndef, z.string().optional()),
  notes: z.preprocess(emptyToUndef, z.string().optional()),
  saleDate: z.preprocess(emptyToUndef, z.string().optional()),
  status: z.enum(["Closed", "Pending", "Refunded"]).optional()
});

function serializeSaleLead(row: typeof schema.leads.$inferSelect) {
  const { notesSummary, saleDate, ...rest } = row;
  return {
    ...rest,
    notes: notesSummary ?? null,
    dateOfSale: saleDate
  };
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const payload = token ? await verifyAuthToken(token) : null;
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const departmentId = searchParams.get("departmentId");
  const assignedUserId = searchParams.get("assignedUserId");
  const search = searchParams.get("search")?.trim();

  if (!isRole(payload.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const conditions: SQL[] = [eq(schema.leads.type, "sale")];
  conditions.push(eq(schema.leads.isDeleted, false));
  if (payload.role === "manager") {
    if (!payload.departmentId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    conditions.push(eq(schema.leads.departmentId, payload.departmentId));
  }
  if (payload.role === "employee") {
    conditions.push(eq(schema.leads.assignedUserId, payload.userId));
  }

  if (payload.role === "employee" && assignedUserId) {
    const requested = Number(assignedUserId);
    if (!Number.isNaN(requested) && requested !== payload.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }
  if (payload.role === "manager" && departmentId) {
    const requested = Number(departmentId);
    if (
      !Number.isNaN(requested) &&
      payload.departmentId &&
      requested !== payload.departmentId
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  if (departmentId && !Number.isNaN(Number(departmentId))) {
    conditions.push(eq(schema.leads.departmentId, Number(departmentId)));
  }
  if (assignedUserId && !Number.isNaN(Number(assignedUserId))) {
    conditions.push(eq(schema.leads.assignedUserId, Number(assignedUserId)));
  }
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        ilike(schema.leads.clientName, pattern),
        ilike(schema.leads.phone, pattern),
        ilike(schema.leads.email, pattern),
        ilike(schema.leads.servicePurchased, pattern)
      )!
    );
  }

  const rows = await db
    .select()
    .from(schema.leads)
    .where(and(...conditions))
    .orderBy(desc(schema.leads.createdAt));

  return NextResponse.json({
    leads: rows.map(serializeSaleLead)
  });
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const payload = token ? await verifyAuthToken(token) : null;
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createSaleLeadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid sale lead data", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  if (!isRole(payload.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const effectiveDepartmentId = data.departmentId ?? payload.departmentId;
  if (payload.role !== "admin") {
    if (!payload.departmentId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (data.departmentId != null && data.departmentId !== payload.departmentId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }
  if (payload.role !== "admin" && !effectiveDepartmentId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const shouldAutoAssign = data.assignedUserId == null;
  let assignedUserId: number | null = null;

  if (shouldAutoAssign) {
    assignedUserId = await autoAssignLead({
      leadType: "sale",
      departmentId: effectiveDepartmentId ?? null,
      eligibleRoles: assignableUserRoles
    });

    // Fallback: ensure non-admin creators always get a valid owner.
    if (assignedUserId == null && payload.role !== "admin") {
      assignedUserId = payload.userId;
    }
  } else {
    const requestedAssigned = data.assignedUserId;
    if (typeof requestedAssigned !== "number") {
      return NextResponse.json({ error: "Invalid assignedUserId" }, { status: 400 });
    }

    if (payload.role === "employee") {
      if (requestedAssigned !== payload.userId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      assignedUserId = requestedAssigned;
    } else if (payload.role === "manager") {
      if (!payload.departmentId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const [targetUser] = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(
          and(
            eq(schema.users.id, requestedAssigned),
            eq(schema.users.departmentId, payload.departmentId)
          )
        );

      if (!targetUser) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      assignedUserId = requestedAssigned;
    } else {
      // admin
      assignedUserId = requestedAssigned;
    }
  }

  const saleDateStr =
    data.saleDate && /^\d{4}-\d{2}-\d{2}$/.test(data.saleDate)
      ? data.saleDate
      : getLocalDateString();

  const amountStr =
    data.saleAmount != null ? data.saleAmount.toFixed(2) : null;

  const [lead] = await db
    .insert(schema.leads)
    .values({
      type: "sale",
      clientName: data.clientName,
      phone: data.phone ?? null,
      email: data.email ?? null,
      source: null,
      departmentId: effectiveDepartmentId ?? null,
      assignedUserId,
      status: data.status ?? "Closed",
      notesSummary: data.notes ?? null,
      saleAmount: amountStr,
      servicePurchased: data.servicePurchased ?? null,
      saleDate: saleDateStr as any
    })
    .returning();

  await logActivity({
    userId: payload.userId,
    action: "lead_created",
    entityType: "lead",
    entityId: lead.id
  });
  await logActivity({
    userId: payload.userId,
    action: "lead_assigned",
    entityType: "lead",
    entityId: lead.id
  });

  if (lead.assignedUserId) {
    await db.insert(schema.notifications).values({
      userId: lead.assignedUserId,
      type: "lead_assigned",
      leadId: lead.id,
      message: `You have been assigned a new sales lead: ${lead.clientName}`
    });
  }

  return NextResponse.json({ lead: serializeSaleLead(lead) }, { status: 201 });
}
