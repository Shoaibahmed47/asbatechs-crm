import { GET } from "./route";

jest.mock("@/lib/auth", () => ({
  COOKIE_NAME: "crm_token",
  verifyAuthToken: jest.fn()
}));

jest.mock("@/lib/db", () => ({
  db: {
    select: jest.fn(() => ({
      from: jest.fn().mockResolvedValue([
        {
          userId: 1,
          date: "2026-07-14",
          clockIn: "2026-07-14T10:00:00.000Z",
          clockOut: null,
          totalWorkMinutes: 30,
          totalBreakMinutes: 5
        }
      ])
    }))
  }
}));

jest.mock("@asbatechs-crm/database", () => ({
  schema: { attendanceLogs: {} }
}));

const auth = jest.requireMock("@/lib/auth") as { verifyAuthToken: jest.Mock };

function req(cookie?: string) {
  return {
    cookies: {
      get: () => (cookie ? { value: cookie } : undefined)
    }
  } as any;
}

describe("GET /api/exports/attendance", () => {
  beforeEach(() => {
    auth.verifyAuthToken.mockReset();
  });

  it("rejects unauthenticated requests", async () => {
    auth.verifyAuthToken.mockResolvedValueOnce(null);
    const res = await GET(req());
    expect(res.status).toBe(401);
  });

  it("rejects employee role", async () => {
    auth.verifyAuthToken.mockResolvedValueOnce({ userId: 3, role: "employee" });
    const res = await GET(req("token"));
    expect(res.status).toBe(401);
  });

  it("returns csv for admin", async () => {
    auth.verifyAuthToken.mockResolvedValueOnce({ userId: 1, role: "admin" });
    const res = await GET(req("token"));
    const text = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/csv");
    expect(text).toContain("userId,date,clockIn,clockOut,totalWorkMinutes,totalBreakMinutes");
    expect(text).toContain("1,2026-07-14");
  });
});
