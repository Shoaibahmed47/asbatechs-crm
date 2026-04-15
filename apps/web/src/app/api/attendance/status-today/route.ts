import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { getLocalDateString } from "@/lib/attendance-date";
import { countAttendanceByStatus, getAttendanceStatusForDate } from "@/lib/attendance-status-today";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const payload = token ? await verifyAuthToken(token) : null;

  if (!payload || payload.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const dateParam = searchParams.get("date");
  const date =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : getLocalDateString();

  const { people } = await getAttendanceStatusForDate(date);
  const active = people.filter((p) => p.status === "active").map((p) => p.userId);
  const onBreak = people.filter((p) => p.status === "break").map((p) => p.userId);
  const offline = people.filter((p) => p.status === "offline").map((p) => p.userId);

  return NextResponse.json({
    active,
    onBreak,
    offline,
    counts: countAttendanceByStatus(people),
    people,
    date
  });
}
