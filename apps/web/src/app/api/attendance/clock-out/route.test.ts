import { POST } from "./route";

const selectWhere = jest.fn();
const txUpdateWhere = jest.fn();
const txUpdateSet = jest.fn();

jest.mock("@/lib/auth", () => ({
  COOKIE_NAME: "crm_token",
  verifyAuthToken: jest.fn()
}));
jest.mock("@/lib/attendance-date", () => ({
  getLocalDateString: () => "2026-03-31"
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

beforeEach(() => {
  jest.clearAllMocks();
  txUpdateSet.mockReturnValue({
    where: () => ({
      returning: () => Promise.resolve([{ id: 1, totalWorkMinutes: 120 }])
    })
  });
  txUpdateWhere.mockResolvedValue([{ id: 1, totalWorkMinutes: 120 }]);
});

describe("attendance clock-out route", () => {
  const req = () =>
    ({
      cookies: { get: () => ({ value: "token" }) }
    }) as any;

  it("returns 404 when no attendance log exists", async () => {
    auth.verifyAuthToken.mockResolvedValueOnce({ userId: 2 });
    selectWhere.mockResolvedValueOnce([]);

    const res = await POST(req());
    expect(res.status).toBe(404);
  });

  it("calculates and stores total work minutes on clock-out", async () => {
    auth.verifyAuthToken.mockResolvedValueOnce({ userId: 2 });
    selectWhere
      .mockResolvedValueOnce([
        {
          id: 1,
          clockIn: new Date(Date.now() - 3 * 60 * 60 * 1000),
          clockOut: null,
          totalBreakMinutes: 30
        }
      ])
      .mockResolvedValueOnce([]); // no open break

    const res = await POST(req());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.attendance.totalWorkMinutes).toBeGreaterThan(0);
  });
});
