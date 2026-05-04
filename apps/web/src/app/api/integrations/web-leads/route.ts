import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { getLocalDateString } from "@/lib/attendance-date";
import { assignableUserRoles } from "@/lib/rbac";
import { autoAssignLead } from "@/lib/lead-assignment";
import { logActivity } from "@/lib/audit";
import { getDefaultAdminUserId } from "@/lib/bootstrap-admin";

const payloadSchema = z.object({
  type: z.enum(["hot", "sale"]).default("hot"),
  clientName: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  source: z.string().optional(),
  siteKey: z.string().optional(),
  servicePurchased: z.string().optional(),
  saleAmount: z.number().optional()
});

const siteToDepartment: Record<string, number> = {
  resume: 1,
  design: 2,
  publishing: 3
};

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey || apiKey !== process.env.WEB_LEADS_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid lead payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const departmentId: number | null =
    data.siteKey && data.siteKey in siteToDepartment
      ? siteToDepartment[data.siteKey]
      : null;

  const actorUserId = await getDefaultAdminUserId();

  if (data.type === "sale") {
    const assignedUserId = await autoAssignLead({
      leadType: "sale",
      departmentId,
      eligibleRoles: assignableUserRoles
    });

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
        departmentId,
        assignedUserId,
        status: "Won",
        notesSummary: data.source ?? null,
        saleAmount: amountStr,
        servicePurchased: data.servicePurchased ?? null,
        saleDate: getLocalDateString() as any
      })
      .returning();

    await logActivity({
      userId: actorUserId,
      action: "lead_created",
      entityType: "lead",
      entityId: lead.id
    });
    await logActivity({
      userId: actorUserId,
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

    return NextResponse.json({ lead }, { status: 201 });
  }

  const assignedUserId = await autoAssignLead({
    leadType: "hot",
    departmentId,
    eligibleRoles: assignableUserRoles
  });

  const [lead] = await db
    .insert(schema.leads)
    .values({
      type: "hot",
      clientName: data.clientName,
      phone: data.phone ?? null,
      email: data.email ?? null,
      source: data.source ?? data.siteKey ?? null,
      departmentId,
      assignedUserId,
      status: "New",
      notesSummary: null,
      saleAmount: null,
      servicePurchased: null,
      saleDate: null
    })
    .returning();

  await logActivity({
    userId: actorUserId,
    action: "lead_created",
    entityType: "lead",
    entityId: lead.id
  });
  await logActivity({
    userId: actorUserId,
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

  return NextResponse.json({ lead }, { status: 201 });
}
