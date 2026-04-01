import { POST } from "./route";

const selectWhere = jest.fn();
const insertValues = jest.fn();
const updateWhere = jest.fn();
const updateSet = jest.fn();

jest.mock("@/lib/auth", () => ({
  COOKIE_NAME: "crm_token",
  verifyAuthToken: jest.fn()
}));
jest.mock("@/lib/mail", () => ({
  sendInviteEmail: jest.fn().mockResolvedValue(undefined)
}));
jest.mock("@/lib/db", () => ({
  db: {
    select: jest.fn(() => ({
      from: jest.fn(() => ({ where: selectWhere }))
    })),
    insert: jest.fn(() => ({ values: insertValues })),
    update: jest.fn(() => ({ set: updateSet }))
  }
}));
jest.mock("@asbatechs-crm/database", () => ({
  schema: { users: {}, invitations: {} }
}));

const auth = jest.requireMock("@/lib/auth") as {
  verifyAuthToken: jest.Mock;
};
const mail = jest.requireMock("@/lib/mail") as {
  sendInviteEmail: jest.Mock;
};

beforeEach(() => {
  jest.clearAllMocks();
  updateSet.mockReturnValue({ where: updateWhere });
});

describe("admin employee invites", () => {
  function req(body: unknown) {
    return {
      cookies: { get: () => ({ value: "cookie-token" }) },
      json: async () => body
    } as any;
  }

  it("sends a new invite", async () => {
    auth.verifyAuthToken.mockResolvedValue({ userId: 1, role: "admin" });
    // first select => users, second select => invites
    selectWhere.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const res = await POST(req({ email: "new@x.com", action: "invite" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(insertValues).toHaveBeenCalled();
    expect(mail.sendInviteEmail).toHaveBeenCalledWith(
      "new@x.com",
      expect.stringContaining("/employee-signup/")
    );
  });

  it("prevents duplicate invite and allows resend flag", async () => {
    auth.verifyAuthToken.mockResolvedValue({ userId: 1, role: "admin" });
    selectWhere
      .mockResolvedValueOnce([]) // users
      .mockResolvedValueOnce([{ id: 99, email: "dup@x.com", acceptedAt: null }]); // invites

    const res = await POST(req({ email: "dup@x.com", action: "invite" }));
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.code).toBe("EMAIL_ALREADY_ADDED");
    expect(data.canResend).toBe(true);
  });

  it("resends existing invite", async () => {
    auth.verifyAuthToken.mockResolvedValue({ userId: 1, role: "admin" });
    selectWhere
      .mockResolvedValueOnce([]) // users
      .mockResolvedValueOnce([{ id: 88, email: "dup@x.com", acceptedAt: null }]); // invites

    const res = await POST(req({ email: "dup@x.com", action: "resend" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.resent).toBe(true);
    expect(updateWhere).toHaveBeenCalled();
    expect(mail.sendInviteEmail).toHaveBeenCalled();
  });
});
