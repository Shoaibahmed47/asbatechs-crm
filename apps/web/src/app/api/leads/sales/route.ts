import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { getLocalDateString } from "@/lib/attendance-date";
import { assignableUserRoles, isRole } from "@/lib/rbac";
import { autoAssignLead } from "@/lib/lead-assignment";
import { logActivity } from "@/lib/audit";
import { LEAD_STAGE_OPTIONS } from "@/lib/lead-workflow";
import { leadValidationUserMessage } from "@/lib/lead-api-errors";
import {
  collectLeadListConditions,
  countLeads,
  parseListPagination,
  resolveLeadOrderBy
} from "@/lib/leads-query";

const emptyToUndef = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

const createSaleLeadSchema = z.object({
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
  departmentId: z.union([z.number().int(), z.null()]).optional(),
  assignedUserId: z.union([z.number().int(), z.null()]).optional(),
  saleAmount: z
    .number({ invalid_type_error: "Sale amount must be a number." })
    .nonnegative("Sale amount cannot be negative.")
    .optional(),
  source: z.preprocess(emptyToUndef, z.string().optional()),
  servicePurchased: z.preprocess(emptyToUndef, z.string().optional()),
  notes: z.preprocess(emptyToUndef, z.string().optional()),
  saleDate: z.preprocess(emptyToUndef, z.string().optional()),
  status: z.enum(LEAD_STAGE_OPTIONS).optional()
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
  const parsed = collectLeadListConditions("sale", payload, searchParams);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }

  const whereClause = and(...parsed.conditions)!;
  const { page, limit, offset } = parseListPagination(searchParams);
  const orderByParts = resolveLeadOrderBy("sale", searchParams);
  const total = await countLeads(whereClause);
  const rows = await db
    .select()
    .from(schema.leads)
    .where(whereClause)
    .orderBy(...orderByParts)
    .limit(limit)
    .offset(offset);

  const [agg] = await db
    .select({
      sum: sql<string>`coalesce(sum(${schema.leads.saleAmount})::numeric, 0)::text`.as(
        "sum_sale"
      )
    })
    .from(schema.leads)
    .where(whereClause);

  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

  return NextResponse.json({
    leads: rows.map(serializeSaleLead),
    total,
    page,
    limit,
    totalPages,
    sumSaleAmount: agg?.sum ?? "0"
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
      {
        error: leadValidationUserMessage(parsed.error),
        details: parsed.error.flatten()
      },
      { status: 400 }
    );
  }

  const data = parsed.data;

  if (!isRole(payload.role)) {
    return NextResponse.json(
      { error: "Your account role cannot create sales leads. Ask an administrator." },
      { status: 403 }
    );
  }

  const [currentUser] = await db
    .select({
      id: schema.users.id,
      departmentId: schema.users.departmentId
    })
    .from(schema.users)
    .where(eq(schema.users.id, payload.userId));
  if (!currentUser) {
    return NextResponse.json(
      {
        error:
          "Your session user no longer exists in the database. Please sign out and log in again."
      },
      { status: 401 }
    );
  }
  const currentDepartmentId = currentUser?.departmentId ?? null;

  if (payload.role === "manager") {
    if (!currentDepartmentId) {
      return NextResponse.json(
        {
          error:
            "Your profile has no department. An admin must assign you to a department before you can save sales leads."
        },
        { status: 403 }
      );
    }
    if (data.departmentId != null && data.departmentId !== currentDepartmentId) {
      return NextResponse.json(
        { error: "You can only create sales leads for your own department." },
        { status: 403 }
      );
    }
  }

  const assignmentDepartmentId =
    payload.role === "manager" ? currentDepartmentId : null;
  const shouldAutoAssign = data.assignedUserId == null;
  let assignedUserId: number | null = null;

  if (shouldAutoAssign) {
    assignedUserId = await autoAssignLead({
      leadType: "sale",
      departmentId: assignmentDepartmentId,
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
      assignedUserId = requestedAssigned;
    } else if (payload.role === "manager") {
      if (!currentDepartmentId) {
        return NextResponse.json(
          { error: "Your manager profile has no department. Contact an administrator." },
          { status: 403 }
        );
      }

      const [targetUser] = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(
          and(
            eq(schema.users.id, requestedAssigned),
            eq(schema.users.departmentId, currentDepartmentId)
          )
        );

      if (!targetUser) {
        return NextResponse.json(
          { error: "You can only assign sales leads to people in your own department." },
          { status: 403 }
        );
      }
      assignedUserId = requestedAssigned;
    } else {
      // admin
      assignedUserId = requestedAssigned;
    }
  }

  let effectiveDepartmentId: number | null = currentDepartmentId;
  if (assignedUserId != null) {
    const [assignee] = await db
      .select({ departmentId: schema.users.departmentId })
      .from(schema.users)
      .where(eq(schema.users.id, assignedUserId));
    if (!assignee) {
      return NextResponse.json({ error: "Assigned user not found." }, { status: 400 });
    }
    effectiveDepartmentId = assignee.departmentId ?? null;
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
      source: data.source ?? null,
      departmentId: effectiveDepartmentId ?? null,
      assignedUserId,
      status: data.status ?? "Won",
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
