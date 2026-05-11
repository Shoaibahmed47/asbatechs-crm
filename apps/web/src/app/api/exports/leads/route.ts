import { NextRequest, NextResponse } from "next/server";
import { and, eq, getTableColumns } from "drizzle-orm";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { isRole } from "@/lib/rbac";
import {
  collectLeadListConditions,
  resolveLeadOrderBy
} from "@/lib/leads-query";

const MAX_EXPORT_ROWS = 10_000;

type LeadExportJsonRow = {
  type: string;
  id: number;
  clientName: string;
  phone: string | null;
  email: string | null;
  source: string | null;
  departmentName: string | null;
  assignedUserName: string | null;
  assignedUserEmail: string | null;
  status: string;
  servicePurchased: string | null;
  saleAmount: string | null;
  saleDate: string | null;
  createdAt: string | null;
};

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const payload = token ? await verifyAuthToken(token) : null;
  if (!payload || !isRole(payload.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const typeParam = searchParams.get("type");
  const leadType = typeParam === "hot" || typeParam === "sale" ? typeParam : "all";

  const parsed = collectLeadListConditions(leadType, payload, searchParams);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }

  const whereClause = and(...parsed.conditions)!;
  const orderByParts = resolveLeadOrderBy(leadType, searchParams);

  if (searchParams.get("format") === "json") {
    const leadCols = getTableColumns(schema.leads);
    const assignee = schema.users;
    const rows = await db
      .select({
        ...leadCols,
        departmentName: schema.departments.name,
        assignedUserName: assignee.name,
        assignedUserEmail: assignee.email
      })
      .from(schema.leads)
      .leftJoin(schema.departments, eq(schema.leads.departmentId, schema.departments.id))
      .leftJoin(assignee, eq(schema.leads.assignedUserId, assignee.id))
      .where(whereClause)
      .orderBy(...orderByParts)
      .limit(MAX_EXPORT_ROWS);

    const leads: LeadExportJsonRow[] = rows.map((r) => ({
      type: r.type,
      id: r.id,
      clientName: r.clientName,
      phone: r.phone,
      email: r.email,
      source: r.source,
      departmentName: r.departmentName,
      assignedUserName: r.assignedUserName,
      assignedUserEmail: r.assignedUserEmail,
      status: r.status,
      servicePurchased: r.servicePurchased,
      saleAmount: r.saleAmount != null ? String(r.saleAmount) : null,
      saleDate: r.saleDate,
      createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : null
    }));

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      leads
    });
  }

  const rows = await db
    .select()
    .from(schema.leads)
    .where(whereClause)
    .orderBy(...orderByParts)
    .limit(MAX_EXPORT_ROWS);

  const lines: string[] = [];
  lines.push(
    "type,id,clientName,phone,email,source,departmentId,assignedUserId,status,notes,saleAmount,servicePurchased,saleDate,createdAt"
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
        l.saleDate ?? "",
        l.createdAt ? new Date(l.createdAt).toISOString() : ""
      ].join(",")
    );
  }

  const csv = lines.join("\n");
  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads-export-${stamp}.csv"`
    }
  });
}

function escapeCsv(s: string) {
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
