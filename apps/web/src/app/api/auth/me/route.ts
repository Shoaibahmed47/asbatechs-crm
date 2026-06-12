import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { eq } from "drizzle-orm";
import { resolveStaffAuth } from "@/lib/staff-auth-request";

export async function GET(req: NextRequest) {
  const payload = await resolveStaffAuth(req);
  if (!payload) {
    return NextResponse.json({ user: null }, { status: 200 });
  }

  const [row] = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      role: schema.users.role,
      departmentId: schema.users.departmentId,
      departmentName: schema.departments.name
    })
    .from(schema.users)
    .leftJoin(schema.departments, eq(schema.users.departmentId, schema.departments.id))
    .where(eq(schema.users.id, payload.userId));

  if (!row) {
    return NextResponse.json({ user: null }, { status: 200 });
  }

  return NextResponse.json({
    user: {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      departmentId: row.departmentId,
      departmentName: row.departmentName ?? null
    }
  });
}

