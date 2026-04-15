import { middleware } from "../middleware";

jest.mock("@/lib/auth-edge", () => ({
  COOKIE_NAME: "crm_token",
  CLIENT_COOKIE_NAME: "crm_client_token",
  verifyAuthTokenEdge: jest.fn(),
  verifyClientTokenEdge: jest.fn()
}));

const authEdge = jest.requireMock("@/lib/auth-edge") as {
  verifyAuthTokenEdge: jest.Mock;
  verifyClientTokenEdge: jest.Mock;
};

function makeReq(
  pathname: string,
  opts?: { staffToken?: string; clientToken?: string }
) {
  return {
    url: `http://localhost${pathname}`,
    nextUrl: { pathname },
    headers: new Headers(),
    cookies: {
      get: (name: string) => {
        if (name === "crm_token" && opts?.staffToken) {
          return { value: opts.staffToken };
        }
        if (name === "crm_client_token" && opts?.clientToken) {
          return { value: opts.clientToken };
        }
        return undefined;
      }
    }
  } as any;
}

describe("middleware protected routes", () => {
  beforeEach(() => {
    authEdge.verifyAuthTokenEdge.mockReset();
    authEdge.verifyClientTokenEdge.mockReset();
    authEdge.verifyClientTokenEdge.mockResolvedValue(null);
  });

  it("redirects unauthenticated users to login", async () => {
    authEdge.verifyAuthTokenEdge.mockResolvedValueOnce(null);
    const res = await middleware(makeReq("/dashboard"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("redirects unauthenticated client portal to client login", async () => {
    authEdge.verifyAuthTokenEdge.mockResolvedValue(null);
    authEdge.verifyClientTokenEdge.mockResolvedValue(null);
    const res = await middleware(makeReq("/client"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/client/login");
  });

  it("allows authenticated staff users", async () => {
    authEdge.verifyAuthTokenEdge.mockResolvedValueOnce({
      userId: 1,
      role: "admin",
      departmentId: null
    });
    const res = await middleware(
      makeReq("/dashboard", { staffToken: "staff-jwt" })
    );
    expect(res.status).toBe(200);
  });

  it("redirects non-admin away from department settings", async () => {
    authEdge.verifyAuthTokenEdge.mockResolvedValueOnce({
      userId: 2,
      role: "employee",
      departmentId: 1
    });
    const res = await middleware(
      makeReq("/settings/departments", { staffToken: "staff-jwt" })
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/dashboard");
  });
});
