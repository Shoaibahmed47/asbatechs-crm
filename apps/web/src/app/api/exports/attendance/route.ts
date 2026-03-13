import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";

export async function GET(_req: NextRequest) {
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

