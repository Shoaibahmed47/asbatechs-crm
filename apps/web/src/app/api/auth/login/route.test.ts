import { POST } from "./route";

jest.mock("@/lib/bootstrap-admin", () => ({
  ensureDefaultAdmin: jest.fn().mockResolvedValue(undefined)
}));
jest.mock("@/lib/supabase-user-link", () => ({
  ensureSupabaseIdentityForLogin: jest.fn().mockResolvedValue({
    authUserId: "supabase-user-id",
    source: "created"
  }),
  linkSupabaseAuthId: jest.fn().mockResolvedValue(undefined)
}));
jest.mock("@/lib/auth", () => ({
  COOKIE_NAME: "crm_token",
  findUserByEmail: jest.fn(),
  verifyPassword: jest.fn(),
  signAuthToken: jest.fn()
}));
jest.mock("@/lib/db", () => ({
  db: {
    insert: jest.fn().mockReturnValue({
      values: jest.fn().mockResolvedValue(undefined)
    })
  }
}));
jest.mock("@asbatechs-crm/database", () => ({
  schema: { activityLogs: {} }
}));

const auth = jest.requireMock("@/lib/auth") as {
  findUserByEmail: jest.Mock;
  verifyPassword: jest.Mock;
  signAuthToken: jest.Mock;
};

describe("auth login route", () => {
  it("returns 401 for invalid credentials", async () => {
    auth.findUserByEmail.mockResolvedValueOnce(null);

    const req = new Request("http://localhost/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "x@x.com", password: "bad" })
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toMatch(/invalid email or password/i);
  });

  it("sets cookie and returns user for valid credentials", async () => {
    auth.findUserByEmail.mockResolvedValueOnce({
      id: 1,
      name: "Admin",
      email: "admin@crm.com",
      role: "admin",
      departmentId: null,
      passwordHash: "hash"
    });
    auth.verifyPassword.mockResolvedValueOnce(true);
    auth.signAuthToken.mockResolvedValueOnce("jwt-token");

    const req = new Request("http://localhost/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "admin@crm.com", password: "admin123" })
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.user.email).toBe("admin@crm.com");
    expect(data.token).toBe("jwt-token");
    expect(res.headers.get("set-cookie")).toContain("crm_token=");
  });
});
