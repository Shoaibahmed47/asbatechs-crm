import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { normalizeRole } from "@/lib/rbac";
import { getLocalDateString } from "@/lib/attendance-date";
import { getAttendanceDailyReport } from "@/lib/attendance-daily-report";

function parseDateParam(p: string | null): string {
  if (p && /^\d{4}-\d{2}-\d{2}$/.test(p)) return p;
  return getLocalDateString();
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

  const date = parseDateParam(req.nextUrl.searchParams.get("date"));
  const rows = await getAttendanceDailyReport(date, {
    role: role === "admin" ? "admin" : "manager",
    departmentId: payload.departmentId
  });

  return NextResponse.json({ date, rows });
}
