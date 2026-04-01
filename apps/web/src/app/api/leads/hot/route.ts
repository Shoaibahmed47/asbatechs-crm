import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { assignableUserRoles, isRole } from "@/lib/rbac";
import { autoAssignLead } from "@/lib/lead-assignment";
import { logActivity } from "@/lib/audit";
import {
  collectLeadListConditions,
  countLeads,
  parseListPagination,
  resolveLeadOrderBy
} from "@/lib/leads-query";

const emptyToUndef = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

const createHotLeadSchema = z.object({
  clientName: z.string().min(1, "Client name is required"),
  phone: z.preprocess(emptyToUndef, z.string().optional()),
  email: z.preprocess(emptyToUndef, z.string().email().optional()),
  source: z.preprocess(emptyToUndef, z.string().optional()),
  departmentId: z.union([z.number().int(), z.null()]).optional(),
  assignedUserId: z.union([z.number().int(), z.null()]).optional(),
  status: z.enum(["New", "Contacted", "Follow Up", "Closed"]).optional(),
  notes: z.preprocess(emptyToUndef, z.string().optional())
});

function serializeHotLead(row: typeof schema.leads.$inferSelect) {
  const { notesSummary, ...rest } = row;
  return {
    ...rest,
    notes: notesSummary ?? null
  };
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const payload = token ? await verifyAuthToken(token) : null;
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const parsed = collectLeadListConditions("hot", payload, searchParams);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }

  const whereClause = and(...parsed.conditions)!;
  const { page, limit, offset } = parseListPagination(searchParams);
  const orderByParts = resolveLeadOrderBy("hot", searchParams);
  const total = await countLeads(whereClause);
  const rows = await db
    .select()
    .from(schema.leads)
    .where(whereClause)
    .orderBy(...orderByParts)
    .limit(limit)
    .offset(offset);

  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

  return NextResponse.json({
    leads: rows.map(serializeHotLead),
    total,
    page,
    limit,
    totalPages
  });
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const payload = token ? await verifyAuthToken(token) : null;
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createHotLeadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid lead data", details: parsed.error.flatten() },
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
      leadType: "hot",
      departmentId: effectiveDepartmentId ?? null,
      eligibleRoles: assignableUserRoles
    });

    // Fallback: ensure non-admin creators always get a valid owner.
    if (assignedUserId == null && payload.role !== "admin") {
      assignedUserId = payload.userId;
    }
  } else {
    // Manual assignment requires authorization.
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

  const [lead] = await db
    .insert(schema.leads)
    .values({
      type: "hot",
      clientName: data.clientName,
      phone: data.phone ?? null,
      email: data.email ?? null,
      source: data.source ?? null,
      departmentId: effectiveDepartmentId ?? null,
      assignedUserId,
      status: data.status ?? "New",
      notesSummary: data.notes ?? null,
      saleAmount: null,
      servicePurchased: null,
      saleDate: null
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
      message: `You have been assigned a new hot lead: ${lead.clientName}`
    });
  }

  return NextResponse.json({ lead: serializeHotLead(lead) }, { status: 201 });
}
