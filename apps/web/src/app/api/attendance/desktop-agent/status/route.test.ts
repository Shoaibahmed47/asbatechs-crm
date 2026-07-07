import { GET } from "./route";

const whereMock = jest.fn();
const orderByMock = jest.fn();
const limitMock = jest.fn();

jest.mock("@/lib/auth", () => ({
  COOKIE_NAME: "crm_token",
  verifyAuthToken: jest.fn()
}));
jest.mock("@/lib/attendance-date", () => ({
  getLocalDateString: () => "2026-05-13"
}));
jest.mock("@/lib/attendance-open-shift", () => ({
  resolveOpenAttendanceLogForUser: jest.fn().mockResolvedValue(null)
}));
jest.mock("@/lib/request-origin", () => ({
  resolveAppUrl: () => "http://localhost:3000"
}));
jest.mock("@/lib/db", () => ({
  db: {
    select: jest.fn(() => ({
      from: jest.fn(() => ({
        where: whereMock
      }))
    }))
  }
}));
jest.mock("@asbatechs-crm/database", () => ({
  schema: {
    attendanceLogs: { lastActivityAt: {}, userId: {}, date: {}, lastActivitySource: {} },
    activityLogs: { createdAt: {}, userId: {}, entityType: {}, action: {}, entityId: {} }
  }
}));

const auth = jest.requireMock("@/lib/auth") as { verifyAuthToken: jest.Mock };

describe("attendance desktop-agent status route", () => {
  const req = () =>
    ({
      cookies: { get: () => ({ value: "token" }) },
      headers: { get: () => null }
    }) as any;

  beforeEach(() => {
    jest.clearAllMocks();
    orderByMock.mockReturnValue({ limit: limitMock });
    limitMock.mockResolvedValue([]);
  });

  it("rejects unauthorized request", async () => {
    auth.verifyAuthToken.mockResolvedValueOnce(null);
    const res = await GET(req());
    expect(res.status).toBe(401);
  });

  it("returns not installed when no agent activity exists", async () => {
    auth.verifyAuthToken.mockResolvedValueOnce({ userId: 2, role: "employee" });
    whereMock.mockImplementation(() => ({ orderBy: orderByMock }));

    const res = await GET(req());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.state).toBe("not_installed");
  });
});
