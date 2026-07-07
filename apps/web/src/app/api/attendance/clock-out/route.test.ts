import { POST } from "./route";

const selectWhere = jest.fn();
const txUpdateWhere = jest.fn();
const txUpdateSet = jest.fn();

jest.mock("@/lib/auth", () => ({
  COOKIE_NAME: "crm_token",
  verifyAuthToken: jest.fn()
}));
jest.mock("@/lib/attendance-date", () => ({
  getLocalDateString: () => "2026-03-31",
  formatAttendanceDurationReadable: (minutes: number) => `${minutes} min`
}));
jest.mock("@/lib/attendance-early-leave", () => ({
  computeEarlyLeaveForClockOut: jest.fn().mockResolvedValue({
    earlyLeaveMinutes: 0,
    expectedShiftEndTime: "17:00"
  })
}));
jest.mock("@/lib/attendance-clock-out-service", () => ({
  finalizeAttendanceClockOut: jest.fn()
}));
jest.mock("@/lib/attendance-open-shift", () => ({
  resolveOpenAttendanceLogForUser: jest.fn()
}));
jest.mock("@/lib/db", () => ({
  db: {
    select: jest.fn(() => ({
      from: jest.fn(() => ({ where: selectWhere }))
    })),
    transaction: jest.fn(async (fn: any) =>
      fn({
        update: () => ({
          set: txUpdateSet
        })
      })
    )
  }
}));
jest.mock("@asbatechs-crm/database", () => ({
  schema: { attendanceLogs: {}, breakSessions: {} }
}));

const auth = jest.requireMock("@/lib/auth") as { verifyAuthToken: jest.Mock };
const finalizeAttendanceClockOut = jest.requireMock("@/lib/attendance-clock-out-service")
  .finalizeAttendanceClockOut as jest.Mock;
const resolveOpenAttendanceLogForUser = jest.requireMock("@/lib/attendance-open-shift")
  .resolveOpenAttendanceLogForUser as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  finalizeAttendanceClockOut.mockResolvedValue({
    id: 1,
    totalWorkMinutes: 120,
    totalBreakMinutes: 30
  });
});

describe("attendance clock-out route", () => {
  const req = () =>
    ({
      cookies: { get: () => ({ value: "token" }) }
    }) as any;

  it("returns 404 when no attendance log exists", async () => {
    auth.verifyAuthToken.mockResolvedValueOnce({ userId: 2 });
    resolveOpenAttendanceLogForUser.mockResolvedValueOnce(null);

    const res = await POST(req());
    expect(res.status).toBe(404);
  });

  it("calculates and stores total work minutes on clock-out", async () => {
    auth.verifyAuthToken.mockResolvedValueOnce({ userId: 2 });
    resolveOpenAttendanceLogForUser.mockResolvedValueOnce({
      log: {
        id: 1,
        date: "2026-03-31",
        clockIn: new Date(Date.now() - 3 * 60 * 60 * 1000),
        clockOut: null,
        totalBreakMinutes: 30
      },
      logDate: "2026-03-31"
    });

    const res = await POST(req());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(finalizeAttendanceClockOut).toHaveBeenCalled();
    expect(data.attendance.totalWorkMinutes).toBe(120);
  });

  it("delegates open break handling to finalizeAttendanceClockOut", async () => {
    auth.verifyAuthToken.mockResolvedValueOnce({ userId: 2 });
    resolveOpenAttendanceLogForUser.mockResolvedValueOnce({
      log: {
        id: 1,
        date: "2026-03-31",
        clockIn: new Date(Date.now() - 2 * 60 * 60 * 1000),
        clockOut: null,
        totalBreakMinutes: 5,
        unscheduledIdleMinutes: 3,
        sleepMinutes: 2
      },
      logDate: "2026-03-31"
    });

    const res = await POST(req());

    expect(res.status).toBe(200);
    expect(finalizeAttendanceClockOut).toHaveBeenCalledWith(
      expect.objectContaining({
        activitySource: "browser"
      })
    );
  });
});
