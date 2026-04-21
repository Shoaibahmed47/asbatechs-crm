import { POST } from "./route";

const selectWhere = jest.fn();
const insertValues = jest.fn();
const insertReturning = jest.fn();
const updateWhere = jest.fn();
const updateSet = jest.fn();

jest.mock("@/lib/auth", () => ({
  hashPassword: jest.fn().mockResolvedValue("hashed-password"),
  normalizeEmail: (email: string) => email.trim().toLowerCase()
}));
jest.mock("@/lib/supabase", () => ({
  createSupabaseServerClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: {
          user: {
            email: "invitee@x.com",
            user_metadata: { firstName: "Aisha", lastName: "Khan" }
          }
        },
        error: null
      })
    }
  }))
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
  schema: {
    invitations: { email: {}, acceptedAt: {}, id: {}, token: {}, departmentId: {} },
    users: { email: {}, id: {}, departmentId: {} }
  }
}));

beforeEach(() => {
  jest.clearAllMocks();
  insertValues.mockReturnValue({ returning: insertReturning });
  updateSet.mockReturnValue({ where: updateWhere });
});

describe("employee signup route", () => {
  it("completes a Supabase invite and creates the CRM user", async () => {
    selectWhere
      .mockResolvedValueOnce([
        { id: 55, email: "invitee@x.com", departmentId: 3, acceptedAt: null }
      ])
      .mockResolvedValueOnce([]);
    insertReturning.mockResolvedValueOnce([
      { id: 12, email: "invitee@x.com", role: "employee" }
    ]);

    const req = {
      json: async () => ({ accessToken: "supabase-access-token" })
    } as any;

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.user.email).toBe("invitee@x.com");
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Aisha Khan",
        email: "invitee@x.com",
        departmentId: 3
      })
    );
    expect(updateWhere).toHaveBeenCalled();
  });

  it("rejects invalid signup payloads", async () => {
    const req = {
      json: async () => ({ nope: true })
    } as any;

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toMatch(/invalid signup data/i);
  });
});
