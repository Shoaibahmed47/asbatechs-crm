import { POST } from "./route";

const selectWhere = jest.fn();
const insertReturning = jest.fn();

jest.mock("@/lib/auth", () => ({
  COOKIE_NAME: "crm_token",
  verifyAuthToken: jest.fn()
}));
jest.mock("@/lib/attendance-date", () => ({
  getLocalDateString: () => "2026-03-31"
}));
jest.mock("@/lib/attendance-late-checkin", () => ({
  hasPendingLateExplanation: jest.fn().mockResolvedValue(false),
  getExpectedCheckInTimeForUser: jest.fn().mockResolvedValue("09:00"),
  computeLateMinutes: jest.fn().mockReturnValue(0),
  computeRawLateMinutes: jest.fn().mockReturnValue(0)
}));
jest.mock("@/lib/attendance-early-leave", () => ({
  hasPendingEarlyLeaveExplanation: jest.fn().mockResolvedValue(false)
}));
jest.mock("@/lib/attendance-absence", () => ({
  hasPendingAbsenceExplanation: jest.fn().mockResolvedValue(false)
}));
jest.mock("@/lib/attendance-auto-clock-out", () => ({
  autoClockOutDueOpenShifts: jest.fn().mockResolvedValue({ closedCount: 0, closedLogIds: [] })
}));
jest.mock("@/lib/attendance-office-settings", () => ({
  getAttendanceOfficeHours: jest.fn().mockResolvedValue({
    expectedCheckInTime: "09:00",
    shiftEndTime: "17:00",
    lateGraceMinutes: 15
  })
}));
jest.mock("@/lib/db", () => ({
  db: {
    select: jest.fn(() => ({
      from: jest.fn(() => ({ where: selectWhere }))
    })),
    insert: jest.fn(() => ({
      values: jest.fn(() => ({ returning: insertReturning }))
    })),
    update: jest.fn(() => ({
      set: jest.fn(() => ({
        where: jest.fn(() => ({ returning: jest.fn().mockResolvedValue([]) }))
      }))
    })),
    delete: jest.fn(() => ({ where: jest.fn() }))
  }
}));
jest.mock("@asbatechs-crm/database", () => ({
  schema: { attendanceLogs: {}, breakSessions: {} }
}));

const auth = jest.requireMock("@/lib/auth") as { verifyAuthToken: jest.Mock };

describe("attendance clock-in route", () => {
  const req = (cookie = "token") =>
    ({
      cookies: { get: () => (cookie ? { value: cookie } : undefined) }
    }) as any;
  const reqWithBearer = (token = "token") =>
    ({
      cookies: { get: () => undefined },
      headers: { get: (name: string) => (name === "authorization" ? `Bearer ${token}` : null) }
    }) as any;

  it("rejects unauthorized request", async () => {
    auth.verifyAuthToken.mockResolvedValueOnce(null);
    const res = await POST(req());
    expect(res.status).toBe(401);
  });

  it("creates attendance record on first clock-in", async () => {
    auth.verifyAuthToken.mockResolvedValueOnce({ userId: 3 });
    selectWhere.mockResolvedValueOnce([]);
    insertReturning.mockResolvedValueOnce([{ id: 1, status: "active" }]);

    const res = await POST(req());
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.attendance.status).toBe("active");
  });

  it("accepts bearer token when cookie is missing", async () => {
    auth.verifyAuthToken.mockResolvedValueOnce({ userId: 9 });
    selectWhere.mockResolvedValueOnce([]);
    insertReturning.mockResolvedValueOnce([{ id: 2, status: "active" }]);

    const res = await POST(reqWithBearer());
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.attendance.status).toBe("active");
    expect(auth.verifyAuthToken).toHaveBeenLastCalledWith("token");
  });
});
