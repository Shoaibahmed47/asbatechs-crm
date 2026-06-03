import { NextRequest, NextResponse } from "next/server";

import { COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { getLocalDateString } from "@/lib/attendance-date";
import { getAttendanceEmployeeDetail } from "@/lib/attendance-employee-detail";
import { normalizeRole } from "@/lib/rbac";

function parseDateParam(value: string | null, fallback = getLocalDateString()): string {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback;
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const payload = token ? await verifyAuthToken(token) : null;

  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = normalizeRole(payload.role);
  if (role !== "admin" && role !== "manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (role === "manager" && payload.departmentId == null) {
    return NextResponse.json(
      { error: "Manager account has no department assigned." },
      { status: 403 }
    );
  }

  const userIdRaw = req.nextUrl.searchParams.get("userId");
  const userId = userIdRaw && /^\d+$/.test(userIdRaw) ? Number(userIdRaw) : null;
  if (userId == null) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const date = parseDateParam(req.nextUrl.searchParams.get("date"));
  const breakFrom = parseDateParam(req.nextUrl.searchParams.get("from"), date);
  const breakTo = parseDateParam(req.nextUrl.searchParams.get("to"), date);

  const detail = await getAttendanceEmployeeDetail({
    userId,
    date,
    breakFrom,
    breakTo,
    scope: {
      role: role === "admin" ? "admin" : "manager",
      departmentId: payload.departmentId
    }
  });

  if (!detail) {
    return NextResponse.json(
      { error: "Employee not found or not available in your scope." },
      { status: 404 }
    );
  }

  return NextResponse.json({ detail, date });
}
