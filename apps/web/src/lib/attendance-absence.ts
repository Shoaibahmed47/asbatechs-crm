import { and, eq, gte, isNotNull, lte } from "drizzle-orm";
import { schema } from "@asbatechs-crm/database";
import { db } from "@/lib/db";
import {
  enumerateLocalDates,
  formatAttendanceDateLabel,
  getLocalDateString
} from "@/lib/attendance-date";
import {
  loadEmployeeScheduleContext,
  type UserScheduleFields
} from "@/lib/attendance-employee-schedule";
import {
  isExplanationPromptDueFromSchedule,
  isWorkingDayFromSchedule
} from "@/lib/attendance-employee-working-day";
import type { AttendanceOfficeHours } from "@/lib/attendance-office-hours";
import {
  addAttendanceCalendarDays,
} from "@/lib/attendance-working-days";

export type { PendingAbsenceExplanation } from "@/lib/attendance-absence-types";

const ABSENCE_LOOKBACK_DAYS = 90;

type AbsenceScanContext = {
  today: string;
  scanFrom: string;
  yesterday: string;
  office: AttendanceOfficeHours;
  schedule: UserScheduleFields;
  presentDates: Set<string>;
  explainedDates: Set<string>;
};

function pickPendingFromScan(
  ctx: AbsenceScanContext
): import("@/lib/attendance-absence-types").PendingAbsenceExplanation | null {
  for (const date of enumerateLocalDates(ctx.scanFrom, ctx.yesterday)) {
    if (!isWorkingDayFromSchedule(ctx.schedule, ctx.office, date)) continue;
    if (ctx.presentDates.has(date)) continue;
    if (ctx.explainedDates.has(date)) continue;
    if (!isExplanationPromptDueFromSchedule(ctx.schedule, ctx.office, date, ctx.today)) {
      continue;
    }

    return {
      date,
      dateLabel: formatAttendanceDateLabel(date)
    };
  }

  return null;
}

async function loadAbsenceScanContext(userId: number): Promise<AbsenceScanContext | null> {
  const today = getLocalDateString();
  const lookback = addAttendanceCalendarDays(today, -ABSENCE_LOOKBACK_DAYS);
  const yesterday = addAttendanceCalendarDays(today, -1);
  if (lookback > yesterday) return null;

  const [{ createdAt }, { office, user: schedule }] = await Promise.all([
    db
      .select({ createdAt: schema.users.createdAt })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .then((rows) => rows[0] ?? { createdAt: null }),
    loadEmployeeScheduleContext(userId)
  ]);

  const employmentStart = createdAt
    ? getLocalDateString(new Date(createdAt as Date))
    : lookback;
  const scanFrom = employmentStart > lookback ? employmentStart : lookback;
  if (scanFrom > yesterday) return null;

  const [presentRows, explainedRows] = await Promise.all([
    db
      .select({ date: schema.attendanceLogs.date })
      .from(schema.attendanceLogs)
      .where(
        and(
          eq(schema.attendanceLogs.userId, userId),
          gte(schema.attendanceLogs.date, scanFrom as any),
          lte(schema.attendanceLogs.date, yesterday as any),
          isNotNull(schema.attendanceLogs.clockIn)
        )
      ),
    db
      .select({ date: schema.attendanceAbsenceRecords.date })
      .from(schema.attendanceAbsenceRecords)
      .where(
        and(
          eq(schema.attendanceAbsenceRecords.userId, userId),
          gte(schema.attendanceAbsenceRecords.date, scanFrom as any),
          lte(schema.attendanceAbsenceRecords.date, yesterday as any)
        )
      )
  ]);

  return {
    today,
    scanFrom,
    yesterday,
    office,
    schedule,
    presentDates: new Set(presentRows.map((row) => String(row.date))),
    explainedDates: new Set(explainedRows.map((row) => String(row.date)))
  };
}

export async function findPendingAbsenceExplanation(
  userId: number
): Promise<import("@/lib/attendance-absence-types").PendingAbsenceExplanation | null> {
  const ctx = await loadAbsenceScanContext(userId);
  if (!ctx) return null;
  return pickPendingFromScan(ctx);
}

export async function hasPendingAbsenceExplanation(userId: number): Promise<boolean> {
  const pending = await findPendingAbsenceExplanation(userId);
  return pending != null;
}

async function notifyAdminsAbsenceExplanation(params: {
  employeeUserId: number;
  employeeName: string;
  dateLabel: string;
  reason: string;
}) {
  const admins = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.role, "admin"));

  const message = `${params.employeeName} submitted an absence explanation for ${params.dateLabel}: ${params.reason.slice(0, 200)}`;

  const tasks: Promise<unknown>[] = [
    db.insert(schema.activityLogs).values({
      userId: params.employeeUserId,
      action: "attendance_absence_explanation",
      entityType: "attendance_absence",
      entityId: 0
    })
  ];

  if (admins.length > 0) {
    tasks.push(
      db.insert(schema.notifications).values(
        admins.map((admin) => ({
          userId: admin.id,
          type: "attendance_absence_explanation",
          leadId: null,
          message
        }))
      )
    );
  }

  await Promise.all(tasks);
}

export async function submitAbsenceExplanation(params: {
  userId: number;
  date: string;
  reason: string;
}): Promise<import("@/lib/attendance-absence-types").PendingAbsenceExplanation | null> {
  const reason = params.reason.trim();
  if (reason.length < 3) {
    throw new Error("Please enter a reason (at least 3 characters).");
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(params.date)) {
    throw new Error("Invalid absence date.");
  }

  // One scan only — reuse in-memory context for nextPending instead of scanning twice.
  const ctx = await loadAbsenceScanContext(params.userId);
  if (!ctx) {
    throw new Error("Absence explanation not found or already submitted.");
  }
  const pending = pickPendingFromScan(ctx);
  if (!pending || pending.date !== params.date) {
    throw new Error("Absence explanation not found or already submitted.");
  }

  const now = new Date();

  const [, employee] = await Promise.all([
    db
      .insert(schema.attendanceAbsenceRecords)
      .values({
        userId: params.userId,
        date: params.date as any,
        reason: reason.slice(0, 500),
        reasonSubmittedAt: now
      })
      .onConflictDoUpdate({
        target: [schema.attendanceAbsenceRecords.userId, schema.attendanceAbsenceRecords.date],
        set: {
          reason: reason.slice(0, 500),
          reasonSubmittedAt: now
        }
      }),
    db
      .select({ name: schema.users.name })
      .from(schema.users)
      .where(eq(schema.users.id, params.userId))
      .then((rows) => rows[0] ?? null)
  ]);

  ctx.explainedDates.add(params.date);
  const nextPending = pickPendingFromScan(ctx);

  // Don't block the employee UI on admin fan-out.
  void notifyAdminsAbsenceExplanation({
    employeeUserId: params.userId,
    employeeName: employee?.name?.trim() || "Employee",
    dateLabel: pending.dateLabel,
    reason
  }).catch((error) => {
    console.error("[attendance-absence] failed to notify admins", error);
  });

  return nextPending;
}

export async function getAbsenceExplanationForDate(
  userId: number,
  date: string
): Promise<{ reason: string; reasonSubmittedAt: string } | null> {
  const [row] = await db
    .select({
      reason: schema.attendanceAbsenceRecords.reason,
      reasonSubmittedAt: schema.attendanceAbsenceRecords.reasonSubmittedAt
    })
    .from(schema.attendanceAbsenceRecords)
    .where(
      and(
        eq(schema.attendanceAbsenceRecords.userId, userId),
        eq(schema.attendanceAbsenceRecords.date, date as any)
      )
    );

  if (!row?.reasonSubmittedAt) return null;
  return {
    reason: row.reason,
    reasonSubmittedAt: new Date(row.reasonSubmittedAt as Date).toISOString()
  };
}
