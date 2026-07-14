import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { isAdminRole, isManagerRole } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const payload = token ? await verifyAuthToken(token) : null;

  if (!payload || (!isAdminRole(payload.role) && !isManagerRole(payload.role))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const logs = await db.select().from(schema.attendanceLogs);

  const lines: string[] = [];
  lines.push(
    "userId,date,clockIn,clockOut,totalWorkMinutes,totalBreakMinutes"
  );

  for (const l of logs) {
    lines.push(
      [
        l.userId,
        l.date,
        l.clockIn ?? "",
        l.clockOut ?? "",
        l.totalWorkMinutes ?? 0,
        l.totalBreakMinutes ?? 0
      ].join(",")
    );
  }

  const csv = lines.join("\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": "attachment; filename=attendance.csv"
    }
  });
}
