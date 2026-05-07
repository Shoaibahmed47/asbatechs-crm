import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { isRole } from "@/lib/rbac";
import { logActivity } from "@/lib/audit";

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
  if (!payload || !isRole(payload.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: idParam, type: typeParam } = await context.params;
  const id = Number(idParam);
  const type = normalizeType(typeParam);
  if (Number.isNaN(id) || !type) {
    return NextResponse.json({ error: "Invalid id or type" }, { status: 400 });
  }

  const [leadRow] = await db
    .select()
    .from(schema.leads)
    .where(and(eq(schema.leads.id, id), eq(schema.leads.type, type)));

  if (!leadRow || leadRow.isDeleted) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  if (payload.role === "manager") {
    if (!payload.departmentId || leadRow.departmentId !== payload.departmentId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  await db
    .update(schema.leads)
    .set({ isDeleted: true, updatedAt: new Date() })
    .where(eq(schema.leads.id, id));

  await logActivity({
    userId: payload.userId,
    action: "lead_soft_deleted",
    entityType: "lead",
    entityId: id
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}

