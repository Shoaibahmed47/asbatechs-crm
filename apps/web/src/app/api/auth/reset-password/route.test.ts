import { POST } from "./route";

const selectWhere = jest.fn();
const updateWhere = jest.fn();
const updateSet = jest.fn();

jest.mock("@/lib/auth", () => ({
  hashPassword: jest.fn().mockResolvedValue("hashed-password")
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

beforeEach(() => {
  jest.clearAllMocks();
  updateSet.mockReturnValue({ where: updateWhere });
});

describe("auth reset-password route", () => {
  const req = (body: unknown) => ({ json: async () => body }) as any;

  it("returns 400 for invalid token", async () => {
    selectWhere.mockResolvedValueOnce([]);

    const res = await POST(req({ token: "bad", password: "password123" }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toMatch(/invalid or expired/i);
  });

  it("resets password with valid token", async () => {
    selectWhere.mockResolvedValueOnce([
      { id: 1, resetTokenExpiry: new Date(Date.now() + 60_000) }
    ]);

    const res = await POST(req({ token: "validtoken", password: "password123" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(updateWhere).toHaveBeenCalled();
  });
});
