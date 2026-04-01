import { middleware } from "./middleware";

jest.mock("@/lib/auth-edge", () => ({
  COOKIE_NAME: "crm_token",
  verifyAuthTokenEdge: jest.fn()
}));

const authEdge = jest.requireMock("@/lib/auth-edge") as {
  verifyAuthTokenEdge: jest.Mock;
};

function makeReq(pathname: string, token?: string) {
  return {
    url: `http://localhost${pathname}`,
    nextUrl: { pathname },
    cookies: {
      get: () => (token ? { value: token } : undefined)
    }
  } as any;
}

describe("middleware protected routes", () => {
  it("redirects unauthenticated users to login", async () => {
    authEdge.verifyAuthTokenEdge.mockResolvedValueOnce(null);
    const res = await middleware(makeReq("/dashboard"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("allows authenticated users", async () => {
    authEdge.verifyAuthTokenEdge.mockResolvedValueOnce({
      userId: 1,
      role: "admin",
      departmentId: null
    });
    const res = await middleware(makeReq("/dashboard", "token"));
    expect(res.status).toBe(200);
  });
});
