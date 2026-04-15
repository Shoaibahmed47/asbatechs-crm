import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { getClientSession } from "@/lib/client-session";
import { z } from "zod";

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  companyName: z.string().max(200).nullable().optional()
});

export async function GET() {
  const session = await getClientSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [row] = await db
    .select({
      id: schema.clients.id,
      name: schema.clients.name,
      email: schema.clients.email,
      companyName: schema.clients.companyName,
      createdAt: schema.clients.createdAt
    })
    .from(schema.clients)
    .where(eq(schema.clients.id, session.clientId));

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ client: row });
}

export async function PATCH(req: NextRequest) {
  const session = await getClientSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }

  const updates: Partial<{
    name: string;
    companyName: string | null;
    updatedAt: Date;
  }> = { updatedAt: new Date() };

  if (parsed.data.name != null) updates.name = parsed.data.name;
  if (parsed.data.companyName !== undefined) {
    updates.companyName = parsed.data.companyName;
  }

  const [row] = await db
    .update(schema.clients)
    .set(updates)
    .where(eq(schema.clients.id, session.clientId))
    .returning({
      id: schema.clients.id,
      name: schema.clients.name,
      email: schema.clients.email,
      companyName: schema.clients.companyName
    });

  return NextResponse.json({ client: row });
}
