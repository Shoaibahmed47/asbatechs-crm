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
import { upsertLeadFollowUpReminder } from "@/lib/lead-follow-up-reminder";
import {
  buildFollowUpUtcIso,
  isDateOnly,
  isValidTimeZone
} from "@/lib/follow-up-time";
import {
  collectLeadListConditions,
  countLeads,
  parseListPagination,
  resolveLeadOrderBy
} from "@/lib/leads-query";

const emptyToUndef = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

const createHotLeadSchema = z.object({
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
  notes: z.preprocess(emptyToUndef, z.string().optional()),
  nextFollowUpAtLocal: z.preprocess(emptyToUndef, z.string().optional()),
  followUpTimezone: z.preprocess(emptyToUndef, z.string().optional()),
  nextFollowUpDate: z.preprocess(emptyToUndef, z.string().optional())
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
      {
        error: leadValidationUserMessage(parsed.error),
        details: parsed.error.flatten()
      },
      { status: 400 }
    );
  }

  const data = parsed.data;
  let nextFollowUpAt: Date | null = null;
  let nextFollowUpDate: string | null = null;
  let followUpTimezone: string | null = null;

  if (data.nextFollowUpAtLocal) {
    if (!data.followUpTimezone || !isValidTimeZone(data.followUpTimezone)) {
      return NextResponse.json(
        { error: "Pick a valid follow-up timezone." },
        { status: 400 }
      );
    }
    try {
      const utcIso = buildFollowUpUtcIso({
        localDateTime: data.nextFollowUpAtLocal,
        timeZone: data.followUpTimezone
      });
      nextFollowUpAt = new Date(utcIso);
      nextFollowUpDate = utcIso.slice(0, 10);
      followUpTimezone = data.followUpTimezone;
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
  } else if (data.nextFollowUpDate) {
    if (!isDateOnly(data.nextFollowUpDate)) {
      return NextResponse.json(
        { error: "Follow-up date must be in YYYY-MM-DD format." },
        { status: 400 }
      );
    }
    nextFollowUpDate = data.nextFollowUpDate;
  }

  const effectiveStatus = data.status ?? "New";
  const isActiveStatus = effectiveStatus !== "Won" && effectiveStatus !== "Lost";
  if (isActiveStatus && !nextFollowUpAt && !nextFollowUpDate) {
    return NextResponse.json(
      {
        error:
          "Active hot leads must have a follow-up date and time. Add a follow-up before saving."
      },
      { status: 400 }
    );
  }

  if (!isRole(payload.role)) {
    return NextResponse.json(
      { error: "Your account role cannot create leads. Ask an administrator." },
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
  const currentDepartmentId = currentUser?.departmentId ?? null;

  if (payload.role === "manager") {
    if (!currentDepartmentId) {
      return NextResponse.json(
        {
          error:
            "Your profile has no department. An admin must assign you to a department before you can create leads."
        },
        { status: 403 }
      );
    }
    if (data.departmentId != null && data.departmentId !== currentDepartmentId) {
      return NextResponse.json(
        { error: "You can only create leads for your own department." },
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
      leadType: "hot",
      departmentId: assignmentDepartmentId,
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
          { error: "You can only assign leads to people in your own department." },
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
      status: effectiveStatus,
      notesSummary: data.notes ?? null,
      nextFollowUpAt,
      nextFollowUpDate: nextFollowUpDate ?? null,
      followUpTimezone,
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

  if (lead.assignedUserId) {
    await upsertLeadFollowUpReminder({
      userId: lead.assignedUserId,
      leadId: lead.id,
      clientName: lead.clientName,
      nextFollowUpAt: lead.nextFollowUpAt,
      nextFollowUpDate: lead.nextFollowUpDate
    });
  }

  return NextResponse.json({ lead: serializeHotLead(lead) }, { status: 201 });
}
