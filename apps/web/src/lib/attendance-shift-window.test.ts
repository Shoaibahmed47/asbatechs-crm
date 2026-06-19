import { ATTENDANCE_TIME_ZONE } from "@/lib/attendance-date";
import { buildFollowUpUtcIso } from "@/lib/follow-up-time";
import { resolveOpenShiftCalculationBounds } from "@/lib/attendance-shift-window";
import { computeLiveShiftMinutes } from "@/lib/attendance-shift-minutes";

function localInstant(date: string, time: string): Date {
  return new Date(
    buildFollowUpUtcIso({
      localDateTime: `${date}T${time}`,
      timeZone: ATTENDANCE_TIME_ZONE
    })
  );
}

describe("open shift display window", () => {
  it("does not count work before scheduled check-in", () => {
    const clockIn = localInstant("2026-06-19", "00:17");
    const now = localInstant("2026-06-19", "21:52");

    const bounds = resolveOpenShiftCalculationBounds({
      logDate: "2026-06-19",
      clockIn,
      clockOut: null,
      now,
      expectedCheckInTime: "19:00",
      shiftEndTime: "04:00"
    });

    const live = computeLiveShiftMinutes({
      clockIn,
      clockOut: null,
      now,
      calculationStart: bounds.start,
      calculationEnd: bounds.end,
      breakSessions: []
    });

    expect(bounds.start.toISOString()).toBe(localInstant("2026-06-19", "19:00").toISOString());
    expect(live.workMinutes).toBe(2 * 60 + 52);
  });

  it("stops growing after scheduled shift end", () => {
    const clockIn = localInstant("2026-06-18", "19:10");
    const now = localInstant("2026-06-19", "10:00");

    const bounds = resolveOpenShiftCalculationBounds({
      logDate: "2026-06-18",
      clockIn,
      clockOut: null,
      now,
      expectedCheckInTime: "19:00",
      shiftEndTime: "04:00"
    });

    const live = computeLiveShiftMinutes({
      clockIn,
      clockOut: null,
      now,
      calculationStart: bounds.start,
      calculationEnd: bounds.end,
      breakSessions: []
    });

    expect(bounds.end.toISOString()).toBe(localInstant("2026-06-19", "04:00").toISOString());
    expect(live.workMinutes).toBeLessThan(9 * 60);
  });
});
