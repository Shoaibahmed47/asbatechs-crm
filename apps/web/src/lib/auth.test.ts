import { jwtExpiresInToMaxAgeSeconds, JWT_EXPIRES_IN } from "@/lib/auth";

describe("auth session expiry", () => {
  it("defaults staff JWT to 24h for overnight shifts", () => {
    expect(JWT_EXPIRES_IN).toBe("24h");
  });

  it("converts jose expiry strings to cookie maxAge seconds", () => {
    expect(jwtExpiresInToMaxAgeSeconds("8h")).toBe(8 * 60 * 60);
    expect(jwtExpiresInToMaxAgeSeconds("24h")).toBe(24 * 60 * 60);
    expect(jwtExpiresInToMaxAgeSeconds("7d")).toBe(7 * 24 * 60 * 60);
  });
});
