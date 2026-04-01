import { POST } from "./route";

const selectWhere = jest.fn();
const updateWhere = jest.fn();
const updateSet = jest.fn();

jest.mock("@/lib/auth", () => ({
  COOKIE_NAME: "crm_token",
  verifyAuthToken: jest.fn()
}));
jest.mock("@/lib/rbac", () => ({
  isAdminRole: jest.fn((role: string) => role === "admin")
}));
jest.mock("@/lib/mail", () => ({
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined)
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
  schema: { users: {} }
}));

const auth = jest.requireMock("@/lib/auth") as {
  verifyAuthToken: jest.Mock;
};
const mail = jest.requireMock("@/lib/mail") as {
  sendPasswordResetEmail: jest.Mock;
};

beforeEach(() => {
  jest.clearAllMocks();
  updateSet.mockReturnValue({ where: updateWhere });
});

describe("users reset-password route", () => {
  const req = (body: unknown, cookie = "token") =>
    ({
      cookies: { get: () => (cookie ? { value: cookie } : undefined) },
      json: async () => body
    }) as any;

  it("rejects non-admin request", async () => {
    auth.verifyAuthToken.mockResolvedValue({ userId: 2, role: "manager" });

    const res = await POST(req({ email: "a@x.com" }));
    expect(res.status).toBe(403);
  });

  it("sends reset link for admin", async () => {
    auth.verifyAuthToken.mockResolvedValue({ userId: 1, role: "admin" });
    selectWhere.mockResolvedValueOnce([{ id: 9, email: "a@x.com" }]);

    const res = await POST(req({ email: "a@x.com" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(updateWhere).toHaveBeenCalled();
    expect(mail.sendPasswordResetEmail).toHaveBeenCalledWith(
      "a@x.com",
      expect.stringContaining("/reset-password/")
    );
  });
});
