import { NextRequest, NextResponse } from "next/server";

import { COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { getLocalDateString } from "@/lib/attendance-date";
import { getAttendanceEmployeeDetail } from "@/lib/attendance-employee-detail";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const payload = token ? await verifyAuthToken(token) : null;

  if (!payload || (payload.role !== "admin" && payload.role !== "manager")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (payload.role === "manager" && payload.departmentId == null) {
    return NextResponse.json({ error: "No department assigned" }, { status: 403 });
  }

  const userIdRaw = req.nextUrl.searchParams.get("userId");
  const userId = userIdRaw && /^\d+$/.test(userIdRaw) ? Number(userIdRaw) : null;
  if (userId == null) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const dateRaw = req.nextUrl.searchParams.get("date");
  const date =
    dateRaw && /^\d{4}-\d{2}-\d{2}$/.test(dateRaw) ? dateRaw : getLocalDateString();

  const fromRaw = req.nextUrl.searchParams.get("from");
  const toRaw = req.nextUrl.searchParams.get("to");
  const breakFrom =
    fromRaw && /^\d{4}-\d{2}-\d{2}$/.test(fromRaw) ? fromRaw : date;
  const breakTo = toRaw && /^\d{4}-\d{2}-\d{2}$/.test(toRaw) ? toRaw : date;

  const detail = await getAttendanceEmployeeDetail({
    userId,
    date,
    breakFrom,
    breakTo,
    scope: {
      role: payload.role === "admin" ? "admin" : "manager",
      departmentId: payload.departmentId
    }
  });

  if (!detail) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  return NextResponse.json({ detail, date });
}
