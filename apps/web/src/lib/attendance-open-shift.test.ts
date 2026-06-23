import { getLocalDateString } from "@/lib/attendance-date";
import { addAttendanceCalendarDays } from "@/lib/attendance-working-days";
import { resolveOpenAttendanceLogForUser } from "@/lib/attendance-open-shift";

jest.mock("@/lib/db", () => ({
  db: {
    select: jest.fn()
  }
}));

const db = jest.requireMock("@/lib/db").db as {
  select: jest.Mock;
};

function mockOpenLogs(rows: Array<{ date: string; clockIn: Date; clockOut?: Date | null }>) {
  const chain = {
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockResolvedValue(
      rows.map((row, index) => ({
        id: index + 1,
        userId: 42,
        date: row.date,
        clockIn: row.clockIn,
        clockOut: row.clockOut ?? null
      }))
    )
  };
  db.select.mockReturnValue(chain);
}

describe("resolveOpenAttendanceLogForUser", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns today's open log when present", async () => {
    const today = getLocalDateString();
    mockOpenLogs([{ date: today, clockIn: new Date() }]);

    const result = await resolveOpenAttendanceLogForUser({ userId: 42 });

    expect(result?.logDate).toBe(today);
  });

  it("carries yesterday's open log after midnight", async () => {
    const now = new Date("2026-06-24T00:05:00+05:00");
    const yesterday = addAttendanceCalendarDays(getLocalDateString(now), -1);
    mockOpenLogs([
      {
        date: yesterday,
        clockIn: new Date("2026-06-23T23:57:00+05:00")
      }
    ]);

    const result = await resolveOpenAttendanceLogForUser({ userId: 42, now });

    expect(result?.logDate).toBe(yesterday);
    expect(result?.log.clockOut).toBeNull();
  });

  it("prefers today over yesterday when both are open", async () => {
    const now = new Date("2026-06-24T00:05:00+05:00");
    const today = getLocalDateString(now);
    const yesterday = addAttendanceCalendarDays(today, -1);
    mockOpenLogs([
      { date: today, clockIn: new Date("2026-06-24T00:01:00+05:00") },
      { date: yesterday, clockIn: new Date("2026-06-23T23:57:00+05:00") }
    ]);

    const result = await resolveOpenAttendanceLogForUser({ userId: 42, now });

    expect(result?.logDate).toBe(today);
  });
});
