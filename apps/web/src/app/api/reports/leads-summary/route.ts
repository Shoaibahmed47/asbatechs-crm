import { NextRequest, NextResponse } from "next/server";
import { and, count, eq, isNotNull, sum } from "drizzle-orm";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { isRole } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const payload = token ? await verifyAuthToken(token) : null;
  if (!payload || !isRole(payload.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const baseConditions = [eq(schema.leads.isDeleted, false)];
  if (payload.role === "manager") {
    if (!payload.departmentId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    baseConditions.push(eq(schema.leads.departmentId, payload.departmentId));
  }
  if (payload.role === "employee") {
    baseConditions.push(eq(schema.leads.assignedUserId, payload.userId));
  }

  const [hotCount] = await db
    .select({ value: count() })
    .from(schema.leads)
    .where(and(eq(schema.leads.type, "hot"), ...baseConditions));
  const [saleCount] = await db
    .select({ value: count() })
    .from(schema.leads)
    .where(and(eq(schema.leads.type, "sale"), ...baseConditions));
  const [totalSales] = await db
    .select({ value: sum(schema.leads.saleAmount) })
    .from(schema.leads)
    .where(
      and(
        eq(schema.leads.type, "sale"),
        isNotNull(schema.leads.saleAmount),
        ...baseConditions
      )
    );

  return NextResponse.json({
    hotLeads: Number(hotCount?.value ?? 0),
    saleLeads: Number(saleCount?.value ?? 0),
    totalSalesAmount: Number(totalSales?.value ?? 0)
  });
}
