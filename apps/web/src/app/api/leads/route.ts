import { NextRequest, NextResponse } from "next/server";
import { and, eq, getTableColumns } from "drizzle-orm";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import {
  collectLeadListConditions,
  countLeads,
  parseListPagination,
  resolveLeadOrderBy
} from "@/lib/leads-query";

function serializeLead(
  row: typeof schema.leads.$inferSelect & {
    departmentName: string | null;
    assignedUserName: string | null;
    assignedUserEmail: string | null;
  }
) {
  const { notesSummary, saleDate, departmentName, assignedUserName, assignedUserEmail, ...rest } = row;
  return {
    ...rest,
    notes: notesSummary ?? null,
    dateOfSale: saleDate ?? null,
    departmentName: departmentName ?? null,
    assignedUserName: assignedUserName ?? null,
    assignedUserEmail: assignedUserEmail ?? null
  };
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const payload = token ? await verifyAuthToken(token) : null;
  if (!payload) {
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
  const { page, limit, offset } = parseListPagination(searchParams);
  const orderByParts = resolveLeadOrderBy("all", searchParams);
  const total = await countLeads(whereClause);
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
    .limit(limit)
    .offset(offset);

  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

  return NextResponse.json({
    leads: rows.map(serializeLead),
    total,
    page,
    limit,
    totalPages
  });
}

