import { POST } from "./route";

const selectWhere = jest.fn();
const updateWhere = jest.fn();
const updateSet = jest.fn();
const insertValues = jest.fn();

jest.mock("@/lib/auth", () => ({
  COOKIE_NAME: "crm_token",
  verifyAuthToken: jest.fn()
}));
jest.mock("@/lib/rbac", () => ({
  isRole: jest.fn(() => true)
}));
jest.mock("@/lib/audit", () => ({
  logActivity: jest.fn().mockResolvedValue(undefined)
}));
jest.mock("@/lib/db", () => ({
  db: {
    select: jest.fn(() => ({
      from: jest.fn(() => ({ where: selectWhere }))
    })),
    update: jest.fn(() => ({ set: updateSet })),
    insert: jest.fn(() => ({ values: insertValues })),
    delete: jest.fn(() => ({ where: jest.fn().mockResolvedValue(undefined) }))
  }
}));
jest.mock("@asbatechs-crm/database", () => ({
  schema: { leads: {}, notifications: {} }
}));

const auth = jest.requireMock("@/lib/auth") as { verifyAuthToken: jest.Mock };

beforeEach(() => {
  jest.clearAllMocks();
  updateSet.mockReturnValue({
    where: () => ({
      returning: () =>
        Promise.resolve([
          {
            id: 5,
            clientName: "Acme",
            assignedUserId: 3,
            nextFollowUpDate: "2026-04-01"
          }
        ])
    })
  });
  insertValues.mockResolvedValue(undefined);
});

describe("lead follow-up route", () => {
  const req = (body: unknown) =>
    ({
      cookies: { get: () => ({ value: "token" }) },
      json: async () => body
    }) as any;

  it("returns 400 for invalid follow-up payload", async () => {
    auth.verifyAuthToken.mockResolvedValueOnce({ userId: 1, role: "admin" });
    const res = await POST(req({ nextFollowUpDate: "bad-date" }), {
      params: Promise.resolve({ type: "hot", id: "5" })
    });
    expect(res.status).toBe(400);
  });

  it("updates lead follow-up date", async () => {
    auth.verifyAuthToken.mockResolvedValueOnce({ userId: 1, role: "admin" });
    selectWhere.mockResolvedValueOnce([{ id: 5, type: "hot", assignedUserId: 3 }]);

    const res = await POST(
      req({ nextFollowUpDate: null, message: "Call back" }),
      {
        params: Promise.resolve({ type: "hot", id: "5" })
      }
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.lead.id).toBe(5);
  });
});
