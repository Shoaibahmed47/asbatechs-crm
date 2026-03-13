import { NextResponse } from "next/server";
import { count, sum } from "drizzle-orm";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";

export async function GET() {
  const [hotCount] = await db
    .select({ value: count() })
    .from(schema.hotLeads);
  const [saleCount] = await db
    .select({ value: count() })
    .from(schema.saleLeads);
  const [totalSales] = await db
    .select({ value: sum(schema.saleLeads.saleAmount) })
    .from(schema.saleLeads);

  return NextResponse.json({
    hotLeads: Number(hotCount?.value ?? 0),
    saleLeads: Number(saleCount?.value ?? 0),
    totalSalesAmount: Number(totalSales?.value ?? 0)
  });
}

