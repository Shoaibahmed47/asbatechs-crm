import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ user: null }, { status: 200 });
  }

  const payload = await verifyAuthToken(token);
  if (!payload) {
    return NextResponse.json({ user: null }, { status: 200 });
  }

  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, payload.userId));

  if (!user) {
    return NextResponse.json({ user: null }, { status: 200 });
  }

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      departmentId: user.departmentId
    }
  });
}

