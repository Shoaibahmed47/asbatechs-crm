import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { hashPassword, normalizeEmail } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  if (
    !body ||
    typeof body.token !== "string" ||
    typeof body.password !== "string"
  ) {
    return NextResponse.json({ error: "Invalid signup data" }, { status: 400 });
  }

  const token = body.token.trim();
  const password = body.password;
  const name =
    typeof body.name === "string" && body.name.trim().length > 0
      ? body.name.trim()
      : undefined;

  if (!token) {
    return NextResponse.json({ error: "Invalid or missing token" }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters long" },
      { status: 400 }
    );
  }

  const [invite] = await db
    .select()
    .from(schema.clientInvitations)
    .where(eq(schema.clientInvitations.token, token));

  if (!invite) {
    return NextResponse.json(
      { error: "Invalid or expired invitation" },
      { status: 400 }
    );
  }

  const emailNorm = normalizeEmail(invite.email);

  const [existingClient] = await db
    .select()
    .from(schema.clients)
    .where(sql`lower(${schema.clients.email}) = ${emailNorm}`);
  if (existingClient) {
    return NextResponse.json({ error: "Client already registered" }, { status: 409 });
  }

  const [existingUser] = await db
    .select()
    .from(schema.users)
    .where(sql`lower(${schema.users.email}) = ${emailNorm}`);
  if (existingUser) {
    return NextResponse.json(
      { error: "This email is already used for a team account" },
      { status: 409 }
    );
  }

  const passwordHash = await hashPassword(password);
  const displayName = name ?? invite.email.split("@")[0] ?? "Client";

  const [client] = await db
    .insert(schema.clients)
    .values({
      name: displayName,
      email: invite.email.trim().toLowerCase(),
      passwordHash,
      companyName: null
    })
    .returning();

  await db
    .update(schema.clientInvitations)
    .set({ acceptedAt: new Date() })
    .where(eq(schema.clientInvitations.id, invite.id));

  return NextResponse.json({
    client: { id: client.id, email: client.email, name: client.name }
  });
}
