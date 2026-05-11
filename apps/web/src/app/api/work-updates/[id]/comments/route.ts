import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { getClientSession } from "@/lib/client-session";
import { isRole } from "@/lib/rbac";

const createSchema = z.object({
  body: z.string().trim().min(1).max(4000)
});

type Ctx = { params: Promise<{ id: string }> };

type ResolvedViewer =
  | { kind: "internal"; userId: number; role: string }
  | { kind: "client"; clientId: number };

async function resolveViewer(req: NextRequest): Promise<ResolvedViewer | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const internal = token ? await verifyAuthToken(token) : null;
  if (internal && isRole(internal.role)) {
    return { kind: "internal", userId: internal.userId, role: internal.role };
  }
  const client = await getClientSession();
  if (client) {
    return { kind: "client", clientId: client.clientId };
  }
  return null;
}

function actorTypeForInsert(viewer: ResolvedViewer): string {
  if (viewer.kind === "client") return "client";
  if (viewer.role === "admin") return "admin";
  if (viewer.role === "manager") return "manager";
  return "employee";
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const viewer = await resolveViewer(req);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = Number((await ctx.params).id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Bad id" }, { status: 400 });
  }

  const [work] = await db
    .select({
      id: schema.clientWorkUpdates.id,
      clientId: schema.clientWorkUpdates.clientId
    })
    .from(schema.clientWorkUpdates)
    .where(eq(schema.clientWorkUpdates.id, id));
  if (!work) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (viewer.kind === "client" && work.clientId !== viewer.clientId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const comments = await db
    .select({
      id: schema.clientWorkComments.id,
      actorType: schema.clientWorkComments.actorType,
      body: schema.clientWorkComments.body,
      createdAt: schema.clientWorkComments.createdAt,
      userName: schema.users.name,
      userEmail: schema.users.email,
      clientName: schema.clients.name,
      clientEmail: schema.clients.email
    })
    .from(schema.clientWorkComments)
    .leftJoin(schema.users, eq(schema.clientWorkComments.actorUserId, schema.users.id))
    .leftJoin(schema.clients, eq(schema.clientWorkComments.actorClientId, schema.clients.id))
    .where(eq(schema.clientWorkComments.workUpdateId, id))
    .orderBy(asc(schema.clientWorkComments.createdAt));

  return NextResponse.json({ comments });
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const viewer = await resolveViewer(req);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = Number((await ctx.params).id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Bad id" }, { status: 400 });
  }

  const [work] = await db
    .select({
      id: schema.clientWorkUpdates.id,
      clientId: schema.clientWorkUpdates.clientId
    })
    .from(schema.clientWorkUpdates)
    .where(eq(schema.clientWorkUpdates.id, id));
  if (!work) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (viewer.kind === "client" && work.clientId !== viewer.clientId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid comment" }, { status: 400 });
  }

  const [comment] = await db
    .insert(schema.clientWorkComments)
    .values({
      workUpdateId: id,
      actorType: actorTypeForInsert(viewer),
      actorUserId: viewer.kind === "internal" ? viewer.userId : null,
      actorClientId: viewer.kind === "client" ? viewer.clientId : null,
      body: parsed.data.body
    })
    .returning();

  return NextResponse.json({ comment }, { status: 201 });
}
