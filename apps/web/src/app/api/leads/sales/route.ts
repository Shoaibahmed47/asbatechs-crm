import { NextRequest, NextResponse } from "next/server";
import { and, eq, ilike } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { COOKIE_NAME, verifyAuthToken } from "@/lib/auth";

const createSaleLeadSchema = z.object({
  clientName: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  departmentId: z.number().nullable().optional(),
  assignedUserId: z.number().nullable().optional(),
  saleAmount: z.number().nonnegative().optional(),
  servicePurchased: z.string().optional(),
  notes: z.string().optional(),
  dateOfSale: z.string().optional()
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const departmentId = searchParams.get("departmentId");
  const assignedUserId = searchParams.get("assignedUserId");
  const search = searchParams.get("search");

  const conditions: any[] = [];
  if (departmentId) {
    conditions.push(eq(schema.saleLeads.departmentId, Number(departmentId)));
  }
  if (assignedUserId) {
    conditions.push(eq(schema.saleLeads.assignedUserId, Number(assignedUserId)));
  }
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      ilike(schema.saleLeads.clientName, pattern) as any
    );
  }

  const where =
    conditions.length === 0 ? undefined : (and as any).apply(null, conditions);

  const leads = await db
    .select()
    .from(schema.saleLeads)
    .where(where as any);

  return NextResponse.json({ leads });
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const payload = token ? await verifyAuthToken(token) : null;
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createSaleLeadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid sale lead data", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  const [lead] = await db
    .insert(schema.saleLeads)
    .values({
      clientName: data.clientName,
      phone: data.phone ?? null,
      email: data.email ?? null,
      departmentId: data.departmentId ?? null,
      assignedUserId: data.assignedUserId ?? payload.userId,
      saleAmount: data.saleAmount ?? null,
      servicePurchased: data.servicePurchased ?? null,
      notesSummary: data.notes ?? null,
      dateOfSale: data.dateOfSale
        ? (data.dateOfSale as any)
        : (new Date().toISOString().slice(0, 10) as any)
    })
    .returning();

  return NextResponse.json({ lead }, { status: 201 });
}

