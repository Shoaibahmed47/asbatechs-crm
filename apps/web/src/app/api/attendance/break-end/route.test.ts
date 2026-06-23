import { POST } from "./route";

const selectWhere = jest.fn();
const updateWhere = jest.fn();
const updateSet = jest.fn();

jest.mock("@/lib/auth", () => ({
  COOKIE_NAME: "crm_token",
  verifyAuthToken: jest.fn()
}));
jest.mock("@/lib/attendance-date", () => ({
  getLocalDateString: () => "2026-03-31"
}));
jest.mock("@/lib/attendance-live-log", () => ({
  resolveAttendanceLogForLiveView: jest.fn()
}));
jest.mock("@/lib/attendance-weekend-guard", () => ({
  rejectAttendanceOnWeekendUnlessOpenShift: jest.fn().mockResolvedValue(null)
}));
jest.mock("@/lib/db", () => ({
  db: {
    select: jest.fn(() => ({
      from: jest.fn(() => ({ where: selectWhere }))
    })),
    update: jest.fn(() => ({ set: updateSet }))
  }
}));
jest.mock("@asbatechs-crm/database", () => ({
  schema: { attendanceLogs: {}, breakSessions: {} }
}));

const auth = jest.requireMock("@/lib/auth") as { verifyAuthToken: jest.Mock };
const resolveAttendanceLogForLiveView = jest.requireMock("@/lib/attendance-live-log")
  .resolveAttendanceLogForLiveView as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  updateSet.mockReturnValue({
    where: () => ({
      returning: () => Promise.resolve([{ id: 1, totalBreakMinutes: 15 }])
    })
  });
  updateWhere.mockResolvedValue([{ id: 1, totalBreakMinutes: 15 }]);
});

describe("attendance break-end route", () => {
  const req = () =>
    ({
      cookies: { get: () => ({ value: "token" }) }
    }) as any;

  it("returns 400 when no open break session exists", async () => {
    auth.verifyAuthToken.mockResolvedValueOnce({ userId: 4 });
    resolveAttendanceLogForLiveView.mockResolvedValueOnce({
      id: 1,
      clockOut: null,
      totalBreakMinutes: 0
    });
    selectWhere.mockResolvedValueOnce([]);

    const res = await POST(req());
    expect(res.status).toBe(400);
  });

  it("ends break and updates attendance totals", async () => {
    auth.verifyAuthToken.mockResolvedValueOnce({ userId: 4 });
    resolveAttendanceLogForLiveView.mockResolvedValueOnce({
      id: 1,
      clockOut: null,
      totalBreakMinutes: 0
    });
    selectWhere.mockResolvedValueOnce([
      { id: 9, breakStart: new Date(Date.now() - 10 * 60 * 1000) }
    ]);

    const res = await POST(req());
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.attendance).toBeDefined();
  });
});
