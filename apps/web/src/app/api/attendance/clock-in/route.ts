import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { getLocalDateString } from "@/lib/attendance-date";
import { getAttendanceOfficeHours } from "@/lib/attendance-office-settings";
import {
  computeLateMinutes,
  computeRawLateMinutes,
  getExpectedCheckInTimeForUser,
  hasPendingLateExplanation
} from "@/lib/attendance-late-checkin";
import {
  buildClockInFeedbackMessage,
  classifyClockInFeedback
} from "@/lib/attendance-clock-feedback";
import { hasPendingAbsenceExplanation } from "@/lib/attendance-absence";
import { hasPendingEarlyLeaveExplanation } from "@/lib/attendance-early-leave";
import { rejectAttendanceIfNotWorkingDay } from "@/lib/attendance-weekend-guard";

function getBearerToken(req: NextRequest): string | null {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(" ");
  if (!scheme || !token) return null;
  if (scheme.toLowerCase() !== "bearer") return null;
  return token.trim() || null;
}

function clockInJson(
  attendance: Record<string, unknown>,
  now: Date,
  expectedCheckInTime: string,
  lateMinutes: number,
  status = 200
) {
  const rawLateMinutes = computeRawLateMinutes(now, expectedCheckInTime);
  const kind = classifyClockInFeedback(rawLateMinutes, lateMinutes);
  return NextResponse.json(
    {
      attendance,
      feedback: {
        kind,
        lateMinutes,
        message: buildClockInFeedbackMessage(kind, lateMinutes)
      }
    },
    { status }
  );
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value ?? getBearerToken(req);
  const payload = token ? await verifyAuthToken(token) : null;

  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = payload.userId;

  const dayOffBlocked = await rejectAttendanceIfNotWorkingDay(userId);
  if (dayOffBlocked) return dayOffBlocked;

  const today = getLocalDateString();

  if (await hasPendingLateExplanation(userId)) {
    return NextResponse.json(
      {
        error:
          "Please submit your late arrival explanation on the Attendance page before clocking in.",
        code: "LATE_EXPLANATION_REQUIRED"
      },
      { status: 403 }
    );
  }

  if (await hasPendingEarlyLeaveExplanation(userId)) {
    return NextResponse.json(
      {
        error:
          "Please submit your early leave explanation on the Attendance page before clocking in.",
        code: "EARLY_LEAVE_EXPLANATION_REQUIRED"
      },
      { status: 403 }
    );
  }

  if (await hasPendingAbsenceExplanation(userId)) {
    return NextResponse.json(
      {
        error:
          "Please submit your absence explanation on the Attendance page before clocking in.",
        code: "ABSENCE_EXPLANATION_REQUIRED"
      },
      { status: 403 }
    );
  }

  try {
    const now = new Date();
    const officeHours = await getAttendanceOfficeHours();
    const expectedCheckInTime = await getExpectedCheckInTimeForUser(userId);
    const lateMinutes = computeLateMinutes(
      now,
      expectedCheckInTime,
      officeHours.lateGraceMinutes
    );

    const [existing] = await db
      .select()
      .from(schema.attendanceLogs)
      .where(
        and(
          eq(schema.attendanceLogs.userId, userId),
          eq(schema.attendanceLogs.date, today as any)
        )
      );

    if (existing) {
      if (existing.clockIn && !existing.clockOut) {
        return NextResponse.json(
          { error: "You are already clocked in." },
          { status: 400 }
        );
      }

      if (existing.clockOut) {
        await db
          .delete(schema.breakSessions)
          .where(eq(schema.breakSessions.attendanceLogId, existing.id));

        const [updated] = await db
          .update(schema.attendanceLogs)
          .set({
            clockIn: now,
            clockOut: null,
            totalWorkMinutes: 0,
            totalBreakMinutes: 0,
            unscheduledIdleMinutes: 0,
            idleEventsCount: 0,
            sleepMinutes: 0,
            sleepEventsCount: 0,
            totalHours: null,
            status: "active",
            lastActivityAt: now,
            lastActivitySource: "browser",
            lateMinutes,
            expectedCheckInTime,
            lateReason: null,
            lateReasonSubmittedAt: null
          })
          .where(eq(schema.attendanceLogs.id, existing.id))
          .returning();
        return clockInJson(updated, now, expectedCheckInTime, lateMinutes);
      }

      const [updated] = await db
        .update(schema.attendanceLogs)
        .set({
          clockIn: now,
          status: "active",
          lastActivityAt: now,
          lastActivitySource: "browser",
          lateMinutes,
          expectedCheckInTime,
          lateReason: null,
          lateReasonSubmittedAt: null
        })
        .where(eq(schema.attendanceLogs.id, existing.id))
        .returning();
      return clockInJson(updated, now, expectedCheckInTime, lateMinutes);
    }

    const [inserted] = await db
      .insert(schema.attendanceLogs)
      .values({
        userId,
        date: today as any,
        clockIn: now,
        totalWorkMinutes: 0,
        totalBreakMinutes: 0,
        unscheduledIdleMinutes: 0,
        idleEventsCount: 0,
        sleepMinutes: 0,
        sleepEventsCount: 0,
        status: "active",
        lastActivityAt: now,
        lastActivitySource: "browser",
        lateMinutes,
        expectedCheckInTime
      })
      .returning();

    return clockInJson(inserted, now, expectedCheckInTime, lateMinutes, 201);
  } catch (error) {
    console.error("[attendance/clock-in]", error);
    return NextResponse.json(
      { error: "Could not clock in. Please try again." },
      { status: 500 }
    );
  }
}
