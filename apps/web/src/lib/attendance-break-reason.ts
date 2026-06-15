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
  endNote: string | null;
  breakStart: Date;
  breakEnd: Date;
  durationMinutes: number;
}) {
  const categoryLabel = formatBreakCategoryLabel(params.breakCategory);
  const startLabel = formatAttendanceClock(params.breakStart);
  const endLabel = formatAttendanceClock(params.breakEnd);
  const durationLabel = formatBreakDurationMinutes(params.durationMinutes);
  const startDetail = params.startNote?.trim() || "No location note";
  const returnDetail = params.endNote?.trim();
  const message = returnDetail
    ? `${params.employeeName} ended break (${categoryLabel} — ${startDetail}). Started ${startLabel}, ended ${endLabel} (${durationLabel}). Return note: ${returnDetail.slice(0, 200)}`
    : `${params.employeeName} ended break (${categoryLabel} — ${startDetail}). Started ${startLabel}, ended ${endLabel} (${durationLabel}).`;

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
