import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";

export async function logActivity(params: {
  userId: number;
  action: string;
  entityType: string;
  entityId: number;
}): Promise<void> {
  const { userId, action, entityType, entityId } = params;
  await db.insert(schema.activityLogs).values({
    userId,
    action,
    entityType,
    entityId
  });
}

