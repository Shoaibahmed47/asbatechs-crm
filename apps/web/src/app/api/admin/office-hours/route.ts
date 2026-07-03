import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { isValidOfficeTime } from "@/lib/attendance-office-hours";
import {
  getAttendanceOfficeHours,
  updateAttendanceOfficeHours
} from "@/lib/attendance-office-settings";

const updateSchema = z.object({
  expectedCheckInTime: z.string().trim(),
  shiftEndTime: z.string().trim(),
  lateGraceMinutes: z.number().int().min(0).max(120)
});

async function requireAdmin(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const payload = token ? await verifyAuthToken(token) : null;
  if (!payload || payload.role !== "admin") {
    return null;
  }
  return payload;
}

export async function GET(req: NextRequest) {
  const payload = await requireAdmin(req);
  if (!payload) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const settings = await getAttendanceOfficeHours();
  return NextResponse.json({ settings });
}

export async function PUT(req: NextRequest) {
  const payload = await requireAdmin(req);
  if (!payload) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid office hours payload." }, { status: 400 });
  }

  const { expectedCheckInTime, shiftEndTime, lateGraceMinutes } = parsed.data;
  if (!isValidOfficeTime(expectedCheckInTime) || !isValidOfficeTime(shiftEndTime)) {
    return NextResponse.json(
      { error: "Times must be valid HH:mm values (e.g. 19:00 for 7:00 PM)." },
      { status: 400 }
    );
  }

  try {
    const settings = await updateAttendanceOfficeHours({
      expectedCheckInTime,
      shiftEndTime,
      lateGraceMinutes,
      updatedByUserId: payload.userId
    });
    return NextResponse.json({ success: true, settings });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save office hours.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
