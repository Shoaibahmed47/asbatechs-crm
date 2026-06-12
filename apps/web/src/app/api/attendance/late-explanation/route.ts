import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import {
  findPendingLateExplanation,
  submitLateExplanation
} from "@/lib/attendance-late-checkin";

const submitSchema = z.object({
  attendanceLogId: z.number().int().positive(),
  reason: z.string().trim().min(3).max(500)
});

function getBearerToken(req: NextRequest): string | null {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(" ");
  if (!scheme || !token) return null;
  if (scheme.toLowerCase() !== "bearer") return null;
  return token.trim() || null;
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value ?? getBearerToken(req);
  const payload = token ? await verifyAuthToken(token) : null;
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pending = await findPendingLateExplanation(payload.userId);
  return NextResponse.json({ pending });
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value ?? getBearerToken(req);
  const payload = token ? await verifyAuthToken(token) : null;
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
    const nextPending = await submitLateExplanation({
      userId: payload.userId,
      attendanceLogId: parsed.data.attendanceLogId,
      reason: parsed.data.reason
    });
    return NextResponse.json({ success: true, nextPending });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not submit late explanation.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
