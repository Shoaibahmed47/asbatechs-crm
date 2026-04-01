import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import type { AuthTokenPayload } from "@/lib/auth";

export function normalizeLeadTypeParam(typeParam: string): "hot" | "sale" | null {
  if (typeParam === "hot") return "hot";
  if (typeParam === "sales" || typeParam === "sale") return "sale";
  return null;
}

export async function fetchLeadForAttachmentAccess(
  payload: AuthTokenPayload,
  leadId: number,
  type: "hot" | "sale"
): Promise<(typeof schema.leads.$inferSelect) | null> {
  const [leadRow] = await db
    .select()
    .from(schema.leads)
    .where(
      and(
        eq(schema.leads.id, leadId),
        eq(schema.leads.type, type),
        eq(schema.leads.isDeleted, false)
      )
    );

  if (!leadRow) {
    return null;
  }

  if (payload.role === "employee" && leadRow.assignedUserId !== payload.userId) {
    return null;
  }

  if (payload.role === "manager") {
    if (!payload.departmentId || leadRow.departmentId !== payload.departmentId) {
      return null;
    }
  }

  return leadRow;
}
