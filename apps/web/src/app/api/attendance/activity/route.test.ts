import { POST } from "./route";

const selectLimit = jest.fn();
let whereInvocation = 0;
const selectWhere = jest.fn(() => {
  whereInvocation += 1;
  if (whereInvocation === 1) {
    return { limit: selectLimit };
  }
  if (whereInvocation === 2) {
    return { orderBy: jest.fn(() => Promise.resolve([])) };
  }
  return Promise.resolve([]);
});
const txInsertValues = jest.fn();
const txUpdateWhere = jest.fn();
const txUpdateSet = jest.fn();
const directUpdateWhere = jest.fn();
const directUpdateSet = jest.fn();

jest.mock("@/lib/auth", () => ({
  COOKIE_NAME: "crm_token",
  verifyAuthToken: jest.fn()
}));
jest.mock("@/lib/db", () => ({
  db: {
    select: jest.fn(() => ({
      from: jest.fn(() => ({ where: selectWhere }))
    })),
    transaction: jest.fn(async (fn: any) =>
      fn({
        insert: () => ({
          values: txInsertValues
        }),
        update: () => ({
          set: txUpdateSet
        })
      })
    ),
    update: jest.fn(() => ({
      set: directUpdateSet
    }))
  }
}));
jest.mock("@/lib/attendance-date", () => ({
  getLocalDateString: () => "2026-05-13"
}));
jest.mock("@/lib/attendance-away-compliance", () => ({
  startComplianceAway: jest.fn().mockResolvedValue({ started: false }),
  endComplianceAway: jest.fn().mockResolvedValue({ ok: true }),
  checkOpenComplianceAwayAlerts: jest.fn().mockResolvedValue(undefined),
  normalizeComplianceAwayCause: jest.fn(() => null),
  maybeAlertAdminsForOpenAway: jest.fn().mockResolvedValue({ alerted: false, awaySeconds: 0 })
}));
jest.mock("@asbatechs-crm/database", () => ({
  schema: {
    attendanceLogs: {},
    breakSessions: {},
    users: { name: "name", id: "id" },
    activityLogs: {},
    notifications: {}
  }
}));

jest.mock("@/lib/attendance-open-shift", () => ({
  resolveOpenAttendanceLogForUser: jest.fn()
}));

const auth = jest.requireMock("@/lib/auth") as { verifyAuthToken: jest.Mock };
const openShift = jest.requireMock("@/lib/attendance-open-shift") as {
  resolveOpenAttendanceLogForUser: jest.Mock;
};
const away = jest.requireMock("@/lib/attendance-away-compliance") as {
  endComplianceAway: jest.Mock;
  startComplianceAway: jest.Mock;
  checkOpenComplianceAwayAlerts: jest.Mock;
};

beforeEach(() => {
  jest.clearAllMocks();
  whereInvocation = 0;
  txInsertValues.mockResolvedValue([{ id: 1 }]);
  txUpdateSet.mockReturnValue({ where: txUpdateWhere });
  txUpdateWhere.mockResolvedValue([{ id: 1 }]);
  directUpdateSet.mockReturnValue({ where: directUpdateWhere });
  directUpdateWhere.mockResolvedValue([{ id: 1 }]);
});

describe("attendance activity route", () => {
  const req = (body: unknown = {}) =>
    ({
      cookies: { get: () => ({ value: "token" }) },
      headers: { get: () => null },
      json: async () => body
    }) as any;

  it("rejects unauthorized request", async () => {
    auth.verifyAuthToken.mockResolvedValueOnce(null);
    const res = await POST(req());
    expect(res.status).toBe(401);
  });

  it("ignores legacy idle_start events", async () => {
    auth.verifyAuthToken.mockResolvedValueOnce({ userId: 5 });
    selectLimit.mockResolvedValueOnce([{ name: "Test User" }]);
    openShift.resolveOpenAttendanceLogForUser.mockResolvedValueOnce(null);

    const res = await POST(req({ event: "idle_start", source: "browser" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ignored).toBe(true);
    expect(txInsertValues).not.toHaveBeenCalled();
  });

  it("resumes sleep away on browser activity but not agent activity", async () => {
    const openLog = {
      id: 42,
      clockIn: new Date("2026-08-07T14:00:00.000Z"),
      clockOut: null,
      status: "idle"
    };
    const openSleep = {
      id: 9,
      breakType: "unscheduled",
      unscheduledCause: "sleep",
      breakStart: new Date("2026-08-07T16:00:00.000Z"),
      returnReason: null
    };

    auth.verifyAuthToken.mockResolvedValue({ userId: 5 });
    selectLimit.mockResolvedValue([{ name: "Test User" }]);
    openShift.resolveOpenAttendanceLogForUser.mockResolvedValue({
      log: openLog,
      logDate: "2026-08-07"
    });
    selectWhere.mockImplementation(() => {
      whereInvocation += 1;
      if (whereInvocation % 2 === 1) {
        return { limit: selectLimit };
      }
      return Promise.resolve([openSleep]);
    });
    away.endComplianceAway.mockResolvedValue({
      ok: true,
      awaySeconds: 120,
      addedMinutes: 2,
      autoReason: "activity_resume"
    });

    const agentRes = await POST(
      req({ event: "activity", source: "electron", observedAt: "2026-08-07T17:00:00.000Z" })
    );
    const agentData = await agentRes.json();
    expect(agentRes.status).toBe(200);
    expect(agentData.needsAwayEnd).toBe(true);
    expect(away.endComplianceAway).not.toHaveBeenCalled();

    const browserRes = await POST(
      req({ event: "activity", source: "browser", observedAt: "2026-08-07T17:00:00.000Z" })
    );
    const browserData = await browserRes.json();
    expect(browserRes.status).toBe(200);
    expect(browserData.resumed).toBe(true);
    expect(away.endComplianceAway).toHaveBeenCalledWith(
      expect.objectContaining({
        cause: "sleep",
        forceCloseExisting: true,
        source: "browser"
      })
    );
  });
});
