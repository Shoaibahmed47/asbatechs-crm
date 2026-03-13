import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";

export async function GET(_req: NextRequest) {
  const hot = await db.select().from(schema.hotLeads);
  const sales = await db.select().from(schema.saleLeads);

  const lines: string[] = [];
  lines.push(
    "type,id,clientName,phone,email,departmentId,assignedUserId,status,saleAmount,servicePurchased,dateOfSale"
  );

  for (const l of hot) {
    lines.push(
      [
        "hot",
        l.id,
        l.clientName,
        l.phone ?? "",
        l.email ?? "",
        l.departmentId ?? "",
        l.assignedUserId ?? "",
        l.status,
        "",
        "",
        ""
      ].join(",")
    );
  }

  for (const l of sales) {
    lines.push(
      [
        "sale",
        l.id,
        l.clientName,
        l.phone ?? "",
        l.email ?? "",
        l.departmentId ?? "",
        l.assignedUserId ?? "",
        "",
        l.saleAmount ?? "",
        l.servicePurchased ?? "",
        l.dateOfSale ?? ""
      ].join(",")
    );
  }

  const csv = lines.join("\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": "attachment; filename=leads.csv"
    }
  });
}

