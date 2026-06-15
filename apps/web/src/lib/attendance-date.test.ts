import {
  enumerateLocalDates,
  formatAttendanceClock,
  formatAttendanceDateTime,
  formatAttendanceDurationReadable,
  getLocalDateString
} from "./attendance-date";

describe("attendance-date", () => {
  it("formats clock-in in Asia/Karachi with PM (not browser-local AM)", () => {
    // 8:00 PM PKT on 2026-06-12 = 15:00 UTC
    const eightPmKarachi = "2026-06-12T15:00:00.000Z";
    const label = formatAttendanceClock(eightPmKarachi);
    expect(label).toMatch(/8:00\s*PM/i);
    expect(label).not.toMatch(/AM/i);
  });

  it("employee and admin formatters share the same 12-hour office clock", () => {
    const instant = "2026-06-12T10:30:00.000Z"; // 3:30 PM PKT
    const clock = formatAttendanceClock(instant);
    const dateTime = formatAttendanceDateTime(instant);
    expect(clock).toMatch(/3:30\s*PM/i);
    expect(dateTime).toMatch(/3:30\s*PM/i);
    expect(dateTime).toMatch(/Jun/i);
  });

  it("enumerates inclusive business dates without server timezone drift", () => {
    expect(enumerateLocalDates("2026-06-10", "2026-06-12")).toEqual([
      "2026-06-10",
      "2026-06-11",
      "2026-06-12"
    ]);
  });

  it("keys today by attendance timezone", () => {
    const instant = new Date("2026-06-12T20:30:00.000Z"); // 1:30 AM PKT on Jun 13
    expect(getLocalDateString(instant)).toBe("2026-06-13");
  });

  it("formats readable durations for late/early badges", () => {
    expect(formatAttendanceDurationReadable(19)).toBe("19 min");
    expect(formatAttendanceDurationReadable(79)).toBe("1 hour 19 min");
    expect(formatAttendanceDurationReadable(60)).toBe("1 hour");
    expect(formatAttendanceDurationReadable(120)).toBe("2 hours");
  });
});
