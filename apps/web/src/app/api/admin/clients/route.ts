import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { asc, desc, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { isAdminRole } from "@/lib/rbac";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const payload = token ? await verifyAuthToken(token) : null;

  if (!payload || !isAdminRole(payload.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const clients = await db
    .select({
      id: schema.clients.id,
      name: schema.clients.name,
      email: schema.clients.email,
      companyName: schema.clients.companyName,
      createdAt: schema.clients.createdAt
    })
    .from(schema.clients)
    .orderBy(desc(schema.clients.createdAt));

  const pendingInvites = await db
    .select({
      id: schema.clientInvitations.id,
      email: schema.clientInvitations.email,
      createdAt: schema.clientInvitations.createdAt
    })
    .from(schema.clientInvitations)
    .where(isNull(schema.clientInvitations.acceptedAt))
    .orderBy(asc(schema.clientInvitations.createdAt));

  return NextResponse.json({ clients, pendingInvites });
}
