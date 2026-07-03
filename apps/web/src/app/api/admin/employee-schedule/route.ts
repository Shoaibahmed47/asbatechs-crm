import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { schema, type EmployeeWeeklySchedule } from "@asbatechs-crm/database";
import { db } from "@/lib/db";
import { COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { normalizeRole } from "@/lib/rbac";
import {
  getEmployeeScheduleSummary,
  updateEmployeeSchedule
} from "@/lib/attendance-employee-schedule";
import { normalizeWeeklySchedule } from "@/lib/attendance-weekly-schedule";

const dayScheduleSchema = z.object({
  isWorking: z.boolean(),
  checkInTime: z.string().trim().nullable().optional(),
  shiftEndTime: z.string().trim().nullable().optional()
});

const weeklyScheduleSchema = z.object({
  sun: dayScheduleSchema,
  mon: dayScheduleSchema,
  tue: dayScheduleSchema,
  wed: dayScheduleSchema,
  thu: dayScheduleSchema,
  fri: dayScheduleSchema,
  sat: dayScheduleSchema
});

const updateSchema = z.object({
  userId: z.number().int().positive(),
  expectedCheckInTime: z.string().trim().nullable(),
  expectedShiftEndTime: z.string().trim().nullable(),
  effectiveFrom: z.string().trim().nullable().optional(),
  weeklyScheduleEnabled: z.boolean().optional(),
  weeklySchedule: weeklyScheduleSchema.nullable().optional()
});

async function authorizeManagerScope(
  payload: { userId: number; role: string; departmentId: number | null },
  targetUserId: number
) {
  const role = normalizeRole(payload.role);
  if (role !== "admin" && role !== "manager") {
    return { error: "Forbidden", status: 403 as const };
  }
  if (role === "manager" && payload.departmentId == null) {
    return { error: "No department assigned", status: 403 as const };
  }
  if (role === "manager") {
    const [user] = await db
      .select({ departmentId: schema.users.departmentId })
      .from(schema.users)
      .where(eq(schema.users.id, targetUserId));
    if (!user || user.departmentId !== payload.departmentId) {
      return { error: "Employee not in your department", status: 403 as const };
    }
  }
  return null;
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const payload = token ? await verifyAuthToken(token) : null;
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userIdRaw = req.nextUrl.searchParams.get("userId");
  const userId = userIdRaw && /^\d+$/.test(userIdRaw) ? Number(userIdRaw) : null;
  if (userId == null) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const scopeError = await authorizeManagerScope(payload, userId);
  if (scopeError) {
    return NextResponse.json({ error: scopeError.error }, { status: scopeError.status });
  }

  const [exists] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.id, userId));
  if (!exists) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  const schedule = await getEmployeeScheduleSummary(userId);
  return NextResponse.json({ schedule });
}

export async function PUT(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const payload = token ? await verifyAuthToken(token) : null;
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid schedule payload." }, { status: 400 });
  }

  const scopeError = await authorizeManagerScope(payload, parsed.data.userId);
  if (scopeError) {
    return NextResponse.json({ error: scopeError.error }, { status: scopeError.status });
  }

  const [exists] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.id, parsed.data.userId));
  if (!exists) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  const weeklySchedule = parsed.data.weeklySchedule
    ? (normalizeWeeklySchedule(parsed.data.weeklySchedule) as EmployeeWeeklySchedule)
    : null;

  try {
    const schedule = await updateEmployeeSchedule({
      userId: parsed.data.userId,
      expectedCheckInTime: parsed.data.expectedCheckInTime,
      expectedShiftEndTime: parsed.data.expectedShiftEndTime,
      effectiveFrom: parsed.data.effectiveFrom ?? null,
      weeklyScheduleEnabled: parsed.data.weeklyScheduleEnabled,
      weeklySchedule
    });
    return NextResponse.json({ schedule });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save schedule.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
