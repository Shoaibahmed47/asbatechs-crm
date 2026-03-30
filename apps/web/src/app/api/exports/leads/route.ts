import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { and, asc, eq } from "drizzle-orm";
import { COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { isRole } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const payload = token ? await verifyAuthToken(token) : null;
  if (!payload || !isRole(payload.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const baseCondition = [eq(schema.leads.isDeleted, false)];
  if (payload.role === "manager") {
    if (!payload.departmentId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    baseCondition.push(eq(schema.leads.departmentId, payload.departmentId));
  }
  if (payload.role === "employee") {
    baseCondition.push(eq(schema.leads.assignedUserId, payload.userId));
  }

  const rows = await db
    .select()
    .from(schema.leads)
    .where(and(...baseCondition))
    .orderBy(asc(schema.leads.type), asc(schema.leads.id));

  const lines: string[] = [];
  lines.push(
    "type,id,clientName,phone,email,source,departmentId,assignedUserId,status,notes,saleAmount,servicePurchased,saleDate"
  );

  for (const l of rows) {
    lines.push(
      [
        l.type,
        l.id,
        escapeCsv(l.clientName),
        l.phone ?? "",
        l.email ?? "",
        l.source ?? "",
        l.departmentId ?? "",
        l.assignedUserId ?? "",
        l.status,
        escapeCsv(l.notesSummary ?? ""),
        l.saleAmount ?? "",
        escapeCsv(l.servicePurchased ?? ""),
        l.saleDate ?? ""
      ].join(",")
    );
  }

  const csv = lines.join("\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": "attachment; filename=leads.csv"
    }
  });
}

function escapeCsv(s: string) {
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
