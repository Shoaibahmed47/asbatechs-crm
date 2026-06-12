import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  findPendingAbsenceExplanation,
  submitAbsenceExplanation
} from "@/lib/attendance-absence";
import { resolveStaffAuth } from "@/lib/staff-auth-request";

const submitSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().trim().min(3).max(500)
});

export async function GET(req: NextRequest) {
  const payload = await resolveStaffAuth(req);
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pending = await findPendingAbsenceExplanation(payload.userId);
  return NextResponse.json({ pending });
}

export async function POST(req: NextRequest) {
  const payload = await resolveStaffAuth(req);
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please enter a reason (at least 3 characters)." },
      { status: 400 }
    );
  }

  try {
    const nextPending = await submitAbsenceExplanation({
      userId: payload.userId,
      date: parsed.data.date,
      reason: parsed.data.reason
    });
    return NextResponse.json({ success: true, nextPending });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not submit absence explanation.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
