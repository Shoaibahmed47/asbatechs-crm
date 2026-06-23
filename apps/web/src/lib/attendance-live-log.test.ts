import {
  resolveAttendanceLogForLiveView,
  userHasOpenAttendanceShift
} from "@/lib/attendance-live-log";
import { getLocalDateString } from "@/lib/attendance-date";

jest.mock("@/lib/db", () => ({
  db: {
    select: jest.fn()
  }
}));

jest.mock("@/lib/attendance-date", () => ({
  getLocalDateString: jest.fn(() => "2026-06-20")
}));

jest.mock("@asbatechs-crm/database", () => ({
  schema: { attendanceLogs: {} }
}));

const db = jest.requireMock("@/lib/db").db as {
  select: jest.Mock;
};

function mockLogForDate(row: unknown) {
  db.select.mockReturnValueOnce({
    from: () => ({
      where: jest.fn().mockResolvedValue(row ? [row] : [])
    })
  });
}

function mockOpenLog(row: unknown) {
  db.select.mockReturnValueOnce({
    from: () => ({
      where: () => ({
        orderBy: () => ({
          limit: jest.fn().mockResolvedValue(row ? [row] : [])
        })
      })
    })
  });
}

describe("attendance live log", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns same-day log when viewing a past date", async () => {
    const fridayLog = { id: 1, date: "2026-06-19", clockIn: new Date(), clockOut: null };
    mockLogForDate(fridayLog);

    const log = await resolveAttendanceLogForLiveView(3, "2026-06-19");
    expect(log).toEqual(fridayLog);
  });

  it("falls back to previous-day open shift when viewing today", async () => {
    mockLogForDate(undefined);
    const openLog = { id: 2, date: "2026-06-19", clockIn: new Date(), clockOut: null };
    mockOpenLog(openLog);

    const log = await resolveAttendanceLogForLiveView(3, "2026-06-20");
    expect(log).toEqual(openLog);
  });

  it("detects open shift for weekend exception guard", async () => {
    mockOpenLog({ id: 3, clockIn: new Date(), clockOut: null });
    await expect(userHasOpenAttendanceShift(3)).resolves.toBe(true);
  });
});
