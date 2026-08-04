import { expect, test } from "@playwright/test";

/**
 * Public / unauthenticated API smoke checks.
 * Auth is required only on protected routes — those must return 401 JSON, not 500/HTML.
 */
test.describe("Public API health", () => {
  test("auth/me returns JSON session shape when logged out", async ({ request }) => {
    const res = await request.get("/api/auth/me");
    expect(res.status(), "auth/me should not crash").toBeLessThan(500);
    expect(res.headers()["content-type"] ?? "").toMatch(/application\/json/i);
    const body = await res.json();
    expect(body).toHaveProperty("user");
  });

  test("attendance policy returns away thresholds JSON", async ({ request }) => {
    const res = await request.get("/api/attendance/policy");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"] ?? "").toMatch(/application\/json/i);
    const body = await res.json();
    expect(body).toHaveProperty("away");
    expect(body.away).toEqual(expect.any(Object));
    expect(body.away).toEqual(
      expect.objectContaining({
        cursorIdleEnabled: expect.any(Boolean)
      })
    );
    // Current deploy includes tabCloseEnabled; older hosts may omit it
    if ("tabCloseEnabled" in body.away) {
      expect(typeof body.away.tabCloseEnabled).toBe("boolean");
    }
    expect(body).toHaveProperty("activityPingSeconds");
  });

  test("protected notifications without cookie returns 401 JSON", async ({ request }) => {
    const res = await request.get("/api/notifications");
    expect(res.status()).toBe(401);
    expect(res.headers()["content-type"] ?? "").toMatch(/application\/json/i);
    const body = await res.json();
    expect(String(body.error ?? "")).toMatch(/unauthor/i);
  });

  test("login POST rejects empty payload with 400 JSON", async ({ request }) => {
    const res = await request.post("/api/auth/login", {
      data: {}
    });
    expect(res.status()).toBe(400);
    expect(res.headers()["content-type"] ?? "").toMatch(/application\/json/i);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  test("login GET is method-not-allowed (POST only)", async ({ request }) => {
    const res = await request.get("/api/auth/login");
    expect(res.status()).toBe(405);
  });

  test("desktop installer redirects to GitHub asset (when deployed)", async ({ request }) => {
    const res = await request.get("/api/desktop/installer", { maxRedirects: 0 });
    if (res.status() === 404) {
      test.skip(
        true,
        "Installer route not on this host (stale custom domain or old deployment)"
      );
    }
    expect([301, 302, 307, 308]).toContain(res.status());
    const location = res.headers()["location"] ?? "";
    expect(location).toMatch(/github\.com|AsbaTechs|\.exe/i);
  });
});

test.describe("Public pages", () => {
  test("login page loads", async ({ page }) => {
    const res = await page.goto("/login", { waitUntil: "domcontentloaded" });
    expect(res?.ok() ?? false).toBeTruthy();
    await expect(page.getByRole("heading", { name: /login/i }).first()).toBeVisible();
  });
});
