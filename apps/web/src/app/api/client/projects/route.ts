import { NextRequest, NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { getClientSession } from "@/lib/client-session";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional()
});

export async function GET() {
  const session = await getClientSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select()
    .from(schema.clientProjects)
    .where(eq(schema.clientProjects.clientId, session.clientId))
    .orderBy(asc(schema.clientProjects.createdAt));

  return NextResponse.json({ projects: rows });
}

export async function POST(req: NextRequest) {
  const session = await getClientSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid project" }, { status: 400 });
  }

  const [row] = await db
    .insert(schema.clientProjects)
    .values({
      clientId: session.clientId,
      name: parsed.data.name,
      description: parsed.data.description ?? null
    })
    .returning();

  return NextResponse.json({ project: row }, { status: 201 });
}
