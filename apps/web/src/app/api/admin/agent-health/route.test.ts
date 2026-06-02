import { GET } from "./route";

jest.mock("@/lib/auth", () => ({
  COOKIE_NAME: "crm_token",
  verifyAuthToken: jest.fn()
}));
jest.mock("@/lib/attendance-date", () => ({
  getLocalDateString: () => "2026-05-13"
}));
jest.mock("@/lib/attendance-agent-health", () => ({
  getAttendanceAgentHealth: jest.fn()
}));

const auth = jest.requireMock("@/lib/auth") as { verifyAuthToken: jest.Mock };
const health = jest.requireMock("@/lib/attendance-agent-health") as {
  getAttendanceAgentHealth: jest.Mock;
};

describe("admin agent health route", () => {
  const req = (query = "") =>
    ({
      cookies: { get: () => ({ value: "token" }) },
      nextUrl: { searchParams: new URLSearchParams(query) }
    }) as any;

  it("rejects unauthorized role", async () => {
    auth.verifyAuthToken.mockResolvedValueOnce({ role: "employee", userId: 1 });
    const res = await GET(req());
    expect(res.status).toBe(403);
  });

  it("returns health rows for admin", async () => {
    auth.verifyAuthToken.mockResolvedValueOnce({ role: "admin", userId: 1, departmentId: null });
    health.getAttendanceAgentHealth.mockResolvedValueOnce({
      rows: [{ userId: 2, state: "running" }],
      counts: { running: 1, installed: 0, stale: 0, not_installed: 0 }
    });

    const res = await GET(req("state=running"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.rows).toHaveLength(1);
    expect(health.getAttendanceAgentHealth).toHaveBeenCalled();
  });
});
