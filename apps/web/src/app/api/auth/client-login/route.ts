import { NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { normalizeEmail, verifyPassword } from "@/lib/auth";
import { CLIENT_COOKIE_NAME, signClientToken } from "@/lib/auth-client";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 400 });
  }

  const email = normalizeEmail(parsed.data.email);
  const password = parsed.data.password;

  const [internal] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(sql`lower(${schema.users.email}) = ${email}`);
  if (internal) {
    return NextResponse.json(
      { error: "This email is registered as a team account. Use the staff login." },
      { status: 403 }
    );
  }

  const [client] = await db
    .select()
    .from(schema.clients)
    .where(sql`lower(${schema.clients.email}) = ${email}`);

  if (!client || !(await verifyPassword(password, client.passwordHash))) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const token = await signClientToken({
    clientId: client.id,
    email: client.email
  });

  const res = NextResponse.json({
    client: {
      id: client.id,
      name: client.name,
      email: client.email
    }
  });

  res.cookies.set(CLIENT_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/"
  });

  return res;
}
