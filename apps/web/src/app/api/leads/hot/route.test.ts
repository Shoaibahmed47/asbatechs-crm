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
jest.mock("@/lib/db", () => ({
  db: {
    insert: jest.fn(() => ({
      values: jest.fn(() => ({
        returning: jest.fn().mockResolvedValue([
          { id: 10, clientName: "Client", type: "hot", assignedUserId: 2 }
        ])
      }))
    }))
  }
}));
jest.mock("@asbatechs-crm/database", () => ({
  schema: { leads: {}, notifications: {} }
}));

const auth = jest.requireMock("@/lib/auth") as { verifyAuthToken: jest.Mock };

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
    const res = await POST(req({ clientName: "Acme", status: "New" }));
    const data = await res.json();
    expect(res.status).toBe(201);
    expect(data.lead.clientName).toBe("Client");
  });
});
