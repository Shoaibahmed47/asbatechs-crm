import { resolveAutoClockOutInstant } from "@/lib/attendance-auto-clock-out";
import { ATTENDANCE_TIME_ZONE } from "@/lib/attendance-date";
import { buildFollowUpUtcIso } from "@/lib/follow-up-time";

function localInstant(date: string, time: string): Date {
  return new Date(
    buildFollowUpUtcIso({
      localDateTime: `${date}T${time}`,
      timeZone: ATTENDANCE_TIME_ZONE
    })
  );
}

describe("resolveAutoClockOutInstant", () => {
  it("returns null before overnight shift end (7 PM → 4 AM)", () => {
    const clockIn = localInstant("2026-06-17", "19:23");
    const now = localInstant("2026-06-18", "03:30");

    const result = resolveAutoClockOutInstant({
      logDate: "2026-06-17",
      clockIn,
      expectedCheckInTime: "19:00",
      shiftEndTime: "04:00",
      now
    });

    expect(result).toBeNull();
  });

  it("returns 4 AM next day after overnight shift end", () => {
    const clockIn = localInstant("2026-06-17", "19:23");
    const now = localInstant("2026-06-18", "10:00");
    const expectedEnd = localInstant("2026-06-18", "04:00");

    const result = resolveAutoClockOutInstant({
      logDate: "2026-06-17",
      clockIn,
      expectedCheckInTime: "19:00",
      shiftEndTime: "04:00",
      now
    });

    expect(result?.toISOString()).toBe(expectedEnd.toISOString());
  });

  it("returns same-day shift end for day shifts", () => {
    const clockIn = localInstant("2026-06-17", "09:15");
    const now = localInstant("2026-06-17", "18:00");
    const expectedEnd = localInstant("2026-06-17", "17:00");

    const result = resolveAutoClockOutInstant({
      logDate: "2026-06-17",
      clockIn,
      expectedCheckInTime: "09:00",
      shiftEndTime: "17:00",
      now
    });

    expect(result?.toISOString()).toBe(expectedEnd.toISOString());
  });
});
