import { POST } from "./route";

const selectWhere = jest.fn();
const insertReturning = jest.fn();
const updateWhere = jest.fn();
const updateSet = jest.fn();

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
    insert: jest.fn(() => ({
      values: jest.fn(() => ({ returning: insertReturning }))
    })),
    update: jest.fn(() => ({ set: updateSet }))
  }
}));
jest.mock("@asbatechs-crm/database", () => ({
  schema: { attendanceLogs: {}, breakSessions: {} }
}));

const auth = jest.requireMock("@/lib/auth") as { verifyAuthToken: jest.Mock };

beforeEach(() => {
  jest.clearAllMocks();
  updateSet.mockReturnValue({ where: updateWhere });
});

describe("attendance break-start route", () => {
  const req = () =>
    ({
      cookies: { get: () => ({ value: "token" }) }
    }) as any;

  it("requires clock-in before break start", async () => {
    auth.verifyAuthToken.mockResolvedValueOnce({ userId: 4 });
    selectWhere.mockResolvedValueOnce([]);

    const res = await POST(req());
    expect(res.status).toBe(400);
  });

  it("starts break and updates status", async () => {
    auth.verifyAuthToken.mockResolvedValueOnce({ userId: 4 });
    selectWhere
      .mockResolvedValueOnce([{ id: 5, clockIn: new Date(), clockOut: null }])
      .mockResolvedValueOnce([]);
    insertReturning.mockResolvedValueOnce([{ id: 77 }]);

    const res = await POST(req());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.session.id).toBe(77);
    expect(updateWhere).toHaveBeenCalled();
  });
});
