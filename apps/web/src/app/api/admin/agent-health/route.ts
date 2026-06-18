import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { getLocalDateString } from "@/lib/attendance-date";
import {
  getAttendanceAgentHealth,
  type AgentHealthState
} from "@/lib/attendance-agent-health";
import { normalizeAgentHealthFilter } from "@/lib/attendance-agent-health-display";

function parseAgentState(value: string | null): AgentHealthState | "all" {
  const filter = normalizeAgentHealthFilter(value);
  return filter === "all" ? "all" : filter;
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const payload = token ? await verifyAuthToken(token) : null;

  if (!payload || (payload.role !== "admin" && payload.role !== "manager")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (payload.role === "manager" && payload.departmentId == null) {
    return NextResponse.json({ rows: [], counts: {} });
  }

  const search = (req.nextUrl.searchParams.get("search") ?? "").trim();
  const departmentRaw = req.nextUrl.searchParams.get("departmentId");
  const departmentFilter =
    departmentRaw && /^\d+$/.test(departmentRaw) ? Number(departmentRaw) : null;
  const stateFilter = parseAgentState(req.nextUrl.searchParams.get("state"));
  const alertsOnly = req.nextUrl.searchParams.get("alerts") === "1";
  const dateRaw = req.nextUrl.searchParams.get("date");
  const date =
    dateRaw && /^\d{4}-\d{2}-\d{2}$/.test(dateRaw) ? dateRaw : getLocalDateString();

  const result = await getAttendanceAgentHealth({
    date,
    scope: {
      role: payload.role === "admin" ? "admin" : "manager",
      departmentId: payload.departmentId
    },
    search,
    departmentFilter,
    stateFilter,
    alertsOnly
  });

  return NextResponse.json({
    rows: result.rows,
    counts: result.counts,
    date
  });
}
