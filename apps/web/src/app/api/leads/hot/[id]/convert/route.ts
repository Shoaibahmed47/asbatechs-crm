import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { isRole } from "@/lib/rbac";
import { logActivity } from "@/lib/audit";
import { getLocalDateString } from "@/lib/attendance-date";

export async function POST(
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

  const [leadRow] = await db
    .select()
    .from(schema.leads)
    .where(and(eq(schema.leads.id, id), eq(schema.leads.isDeleted, false)));

  if (!leadRow) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  if (leadRow.type !== "hot") {
    return NextResponse.json(
      { error: "Only hot leads can be converted from this action." },
      { status: 409 }
    );
  }

  if (
    payload.role === "manager" &&
    (!payload.departmentId || leadRow.departmentId !== payload.departmentId)
  ) {
    return NextResponse.json(
      { error: "You can only convert leads that belong to your department." },
      { status: 403 }
    );
  }

  const [updatedLead] = await db
    .update(schema.leads)
    .set({
      type: "sale",
      status: "Won",
      saleDate: getLocalDateString() as any,
      updatedAt: new Date()
    })
    .where(eq(schema.leads.id, id))
    .returning();

  await logActivity({
    userId: payload.userId,
    action: "lead_converted_to_sale",
    entityType: "lead",
    entityId: id
  });

  return NextResponse.json({ lead: updatedLead }, { status: 200 });
}

