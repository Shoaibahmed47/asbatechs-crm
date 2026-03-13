import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";

const payloadSchema = z.object({
  type: z.enum(["hot", "sale"]).default("hot"),
  clientName: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  source: z.string().optional(),
  siteKey: z.string().optional(),
  servicePurchased: z.string().optional(),
  saleAmount: z.number().optional()
});

const siteToDepartment: Record<string, number> = {
  resume: 1,
  design: 2,
  publishing: 3
};

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey || apiKey !== process.env.WEB_LEADS_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid lead payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const departmentId =
    (data.siteKey && siteToDepartment[data.siteKey]) ?? null;

  if (data.type === "sale") {
    const [lead] = await db
      .insert(schema.saleLeads)
      .values({
        clientName: data.clientName,
        phone: data.phone ?? null,
        email: data.email ?? null,
        departmentId,
        assignedUserId: null,
        saleAmount: data.saleAmount ?? null,
        servicePurchased: data.servicePurchased ?? null,
        notesSummary: data.source ?? null,
        dateOfSale: new Date().toISOString().slice(0, 10) as any
      })
      .returning();
    return NextResponse.json({ lead }, { status: 201 });
  }

  const [lead] = await db
    .insert(schema.hotLeads)
    .values({
      clientName: data.clientName,
      phone: data.phone ?? null,
      email: data.email ?? null,
      source: data.source ?? data.siteKey ?? null,
      departmentId,
      assignedUserId: null,
      status: "New",
      notesSummary: null
    })
    .returning();

  return NextResponse.json({ lead }, { status: 201 });
}

