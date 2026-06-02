import { POST } from "./route";

const selectWhere = jest.fn();
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
jest.mock("@asbatechs-crm/database", () => ({
  schema: { attendanceLogs: {}, breakSessions: {} }
}));

const auth = jest.requireMock("@/lib/auth") as { verifyAuthToken: jest.Mock };

beforeEach(() => {
  jest.clearAllMocks();
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

  it("classifies idle start as unscheduled idle", async () => {
    auth.verifyAuthToken.mockResolvedValueOnce({ userId: 5 });
    selectWhere
      .mockResolvedValueOnce([
        { id: 7, clockIn: new Date(), clockOut: null, status: "active" }
      ])
      .mockResolvedValueOnce([]);

    const res = await POST(req({ event: "idle_start", source: "browser" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.status).toBe("idle");
    expect(txInsertValues).toHaveBeenCalled();
  });
});
