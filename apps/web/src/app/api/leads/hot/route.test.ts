import { POST } from "./route";

jest.mock("@/lib/auth", () => ({
  COOKIE_NAME: "crm_token",
  verifyAuthToken: jest.fn()
}));
jest.mock("@/lib/rbac", () => ({
  isRole: jest.fn(() => true),
  assignableUserRoles: ["employee", "manager"]
}));
jest.mock("@/lib/lead-assignment", () => ({
  autoAssignLead: jest.fn().mockResolvedValue(2)
}));
jest.mock("@/lib/audit", () => ({
  logActivity: jest.fn().mockResolvedValue(undefined)
}));
jest.mock("@/lib/lead-follow-up-reminder", () => ({
  upsertLeadFollowUpReminder: jest.fn().mockResolvedValue(undefined)
}));

/** Refs set inside jest.mock factory (Jest hoists mocks above `const`). */
var __hotLeadSelectWhere: jest.Mock;
var __hotLeadInsertCount: { n: number };

jest.mock("@/lib/db", () => {
  __hotLeadSelectWhere = jest.fn();
  __hotLeadInsertCount = { n: 0 };
  return {
    db: {
      select: jest.fn(() => ({
        from: jest.fn(() => ({ where: __hotLeadSelectWhere }))
      })),
      insert: jest.fn(() => ({
        values: jest.fn(() => {
          __hotLeadInsertCount.n += 1;
          if (__hotLeadInsertCount.n === 1) {
            return {
              returning: jest.fn().mockResolvedValue([
                {
                  id: 10,
                  clientName: "Acme",
                  type: "hot",
                  assignedUserId: 2,
                  notesSummary: null,
                  nextFollowUpAt: null,
                  nextFollowUpDate: "2026-06-15",
                  followUpTimezone: null
                }
              ])
            };
          }
          return Promise.resolve();
        })
      }))
    }
  };
});
jest.mock("@asbatechs-crm/database", () => ({
  schema: {
    leads: {},
    notifications: {},
    users: { id: {}, departmentId: {} }
  }
}));

const auth = jest.requireMock("@/lib/auth") as { verifyAuthToken: jest.Mock };

beforeEach(() => {
  __hotLeadInsertCount.n = 0;
  jest.clearAllMocks();
  __hotLeadSelectWhere
    .mockReset()
    .mockResolvedValueOnce([{ id: 1, departmentId: 1 }])
    .mockResolvedValueOnce([{ departmentId: 1 }]);
});

describe("hot leads route", () => {
  const req = (body: unknown) =>
    ({
      cookies: { get: () => ({ value: "token" }) },
      json: async () => body
    }) as any;

  it("validates required fields", async () => {
    auth.verifyAuthToken.mockResolvedValueOnce({ userId: 1, role: "admin" });
    const res = await POST(req({ clientName: "" }));
    expect(res.status).toBe(400);
  });

  it("creates a lead with valid input", async () => {
    auth.verifyAuthToken.mockResolvedValueOnce({ userId: 1, role: "admin" });
    const res = await POST(
      req({
        clientName: "Acme",
        status: "New",
        nextFollowUpDate: "2026-06-15"
      })
    );
    const data = await res.json();
    expect(res.status).toBe(201);
    expect(data.lead.clientName).toBe("Acme");
  });
});
