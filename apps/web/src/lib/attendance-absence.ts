import { and, eq, gte, isNotNull, lte } from "drizzle-orm";
import { schema } from "@asbatechs-crm/database";
import { db } from "@/lib/db";
import {
  enumerateLocalDates,
  formatAttendanceDateLabel,
  getLocalDateString
} from "@/lib/attendance-date";
import { addAttendanceCalendarDays } from "@/lib/attendance-working-days";
import {
  getEmployeeScheduleBundle,
  resolveEmployeeScheduleForDate,
  type EmployeeScheduleBundle
} from "@/lib/attendance-employee-schedule";

export type { PendingAbsenceExplanation } from "@/lib/attendance-absence-types";

const ABSENCE_LOOKBACK_DAYS = 90;

function isWorkingDayWithBundle(bundle: EmployeeScheduleBundle, date: string): boolean {
  return resolveEmployeeScheduleForDate(bundle.user, bundle.office, date).isWorkingDay;
}

function isExplanationPromptDueWithBundle(
  bundle: EmployeeScheduleBundle,
  logDate: string,
  today: string
): boolean {
  if (logDate >= today) return false;
  let due = addAttendanceCalendarDays(logDate, 1);
  const maxDays = 14;
  for (let i = 0; i < maxDays; i += 1) {
    if (isWorkingDayWithBundle(bundle, due)) {
      return today >= due;
    }
    due = addAttendanceCalendarDays(due, 1);
  }
  return today >= due;
}

export async function findPendingAbsenceExplanation(
  userId: number
): Promise<import("@/lib/attendance-absence-types").PendingAbsenceExplanation | null> {
  const today = getLocalDateString();
  const lookback = addAttendanceCalendarDays(today, -ABSENCE_LOOKBACK_DAYS);
  const yesterday = addAttendanceCalendarDays(today, -1);
  if (lookback > yesterday) return null;

  const [userRow, presentRows, explainedRows, bundle] = await Promise.all([
    db
      .select({ createdAt: schema.users.createdAt })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .then((rows) => rows[0]),
    db
      .select({ date: schema.attendanceLogs.date })
      .from(schema.attendanceLogs)
      .where(
        and(
          eq(schema.attendanceLogs.userId, userId),
          gte(schema.attendanceLogs.date, lookback as any),
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
          gte(schema.attendanceAbsenceRecords.date, lookback as any),
          lte(schema.attendanceAbsenceRecords.date, yesterday as any)
        )
      ),
    getEmployeeScheduleBundle(userId)
  ]);

  const employmentStart = userRow?.createdAt
    ? getLocalDateString(new Date(userRow.createdAt as Date))
    : lookback;
  const scanFrom = employmentStart > lookback ? employmentStart : lookback;
  if (scanFrom > yesterday) return null;

  const presentDates = new Set(presentRows.map((row) => String(row.date)));
  const explainedDates = new Set(explainedRows.map((row) => String(row.date)));

  for (const date of enumerateLocalDates(scanFrom, yesterday)) {
    if (!isWorkingDayWithBundle(bundle, date)) continue;
    if (presentDates.has(date)) continue;
    if (explainedDates.has(date)) continue;
    if (!isExplanationPromptDueWithBundle(bundle, date, today)) continue;

    return {
      date,
      dateLabel: formatAttendanceDateLabel(date)
    };
  }

  return null;
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

  const writes: Promise<unknown>[] = [
    db.insert(schema.activityLogs).values({
      userId: params.employeeUserId,
      action: "attendance_absence_explanation",
      entityType: "attendance_absence",
      entityId: 0
    })
  ];

  if (admins.length > 0) {
    writes.push(
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

  await Promise.all(writes);
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

  const pending = await findPendingAbsenceExplanation(params.userId);
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
      .then((rows) => rows[0])
  ]);

  await notifyAdminsAbsenceExplanation({
    employeeUserId: params.userId,
    employeeName: employee?.name?.trim() || "Employee",
    dateLabel: pending.dateLabel,
    reason
  });

  return findPendingAbsenceExplanation(params.userId);
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
