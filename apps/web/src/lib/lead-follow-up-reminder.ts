import { and, eq, isNull } from "drizzle-orm";
import { schema } from "@asbatechs-crm/database";
import { db } from "@/lib/db";

type UpsertLeadFollowUpReminderInput = {
  userId: number;
  leadId: number;
  clientName: string;
  nextFollowUpAt: Date | null;
  nextFollowUpDate: string | null;
  message?: string | null;
};

export async function clearLeadFollowUpReminders(leadId: number) {
  await db
    .delete(schema.notifications)
    .where(
      and(
        eq(schema.notifications.leadId, leadId),
        eq(schema.notifications.type, "follow_up_reminder"),
        isNull(schema.notifications.readAt)
      )
    );
}

export async function upsertLeadFollowUpReminder(
  input: UpsertLeadFollowUpReminderInput
) {
  const { userId, leadId, clientName, nextFollowUpAt, nextFollowUpDate, message } =
    input;
  await clearLeadFollowUpReminders(leadId);
  if (!nextFollowUpAt && !nextFollowUpDate) {
    return;
  }

  const dueDate = nextFollowUpDate ?? nextFollowUpAt!.toISOString().slice(0, 10);
  await db.insert(schema.notifications).values({
    userId,
    type: "follow_up_reminder",
    leadId,
    dueAt: nextFollowUpAt,
    dueDate,
    message:
      message ??
      (nextFollowUpAt
        ? `Follow up with ${clientName} at ${nextFollowUpAt.toISOString()}.`
        : `Follow up with ${clientName} on ${dueDate}.`)
  });
}
