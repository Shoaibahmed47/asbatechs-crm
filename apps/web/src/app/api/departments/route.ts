import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { COOKIE_NAME, verifyAuthToken } from "@/lib/auth";

const createDepartmentSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional()
});

export async function GET() {
  const departments = await db
    .select()
    .from(schema.departments)
    .orderBy(schema.departments.name);
  return NextResponse.json({ departments });
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const payload = token ? await verifyAuthToken(token) : null;

  if (!payload || payload.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createDepartmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid department data", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const [department] = await db
    .insert(schema.departments)
    .values({
      name: parsed.data.name,
      description: parsed.data.description ?? null
    })
    .returning();

  return NextResponse.json({ department }, { status: 201 });
}

