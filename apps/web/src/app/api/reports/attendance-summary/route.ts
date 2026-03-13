import { NextResponse } from "next/server";
import { sum } from "drizzle-orm";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";

export async function GET() {
  const rows = await db
    .select({
      userId: schema.attendanceLogs.userId,
      totalWorkMinutes: sum(schema.attendanceLogs.totalWorkMinutes),
      totalBreakMinutes: sum(schema.attendanceLogs.totalBreakMinutes)
    })
    .from(schema.attendanceLogs)
    .groupBy(schema.attendanceLogs.userId);

  return NextResponse.json({ rows });
}

