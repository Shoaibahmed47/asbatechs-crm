import { eq } from "drizzle-orm";
import { schema } from "@asbatechs-crm/database";
import { db } from "@/lib/db";
import { formatAttendanceClock } from "@/lib/attendance-date";
import {
  formatBreakCategoryLabel,
  formatBreakDurationMinutes
} from "@/lib/attendance-break-shared";

export async function notifyAdminsManualBreakEnded(params: {
  employeeUserId: number;
  employeeName: string;
  breakCategory: string;
  startNote: string | null;
  endNote: string;
  breakStart: Date;
  breakEnd: Date;
  durationMinutes: number;
}) {
  const categoryLabel = formatBreakCategoryLabel(params.breakCategory);
  const startLabel = formatAttendanceClock(params.breakStart);
  const endLabel = formatAttendanceClock(params.breakEnd);
  const durationLabel = formatBreakDurationMinutes(params.durationMinutes);
  const startDetail = params.startNote?.trim() ? ` — ${params.startNote.trim()}` : "";
  const message = `${params.employeeName} ended break (${categoryLabel}${startDetail}). Started ${startLabel}, ended ${endLabel} (${durationLabel}). Return note: ${params.endNote.trim().slice(0, 200)}`;

  const admins = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.role, "admin"));

  for (const admin of admins) {
    await db.insert(schema.notifications).values({
      userId: admin.id,
      type: "attendance_break_summary",
      leadId: null,
      message
    });
  }

  await db.insert(schema.activityLogs).values({
    userId: params.employeeUserId,
    action: "attendance_break_ended",
    entityType: "break_session",
    entityId: 0
  });
}
