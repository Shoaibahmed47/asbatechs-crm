import { expect, test } from "@playwright/test";

/**
 * Smoke checks for the public desktop installer entry points.
 * Default target: production CRM (override with PLAYWRIGHT_BASE_URL).
 */
test.describe("Desktop app download", () => {
  test("download page shows installer button (not unconfigured notice)", async ({
    page
  }) => {
    await page.goto("/download/desktop", { waitUntil: "domcontentloaded" });

    const unconfigured = page.getByText("Installer URL is not configured yet");
    await expect(unconfigured).toHaveCount(0);

    const btn = page.getByTestId("desktop-download-btn").or(
      page.getByRole("link", { name: /Download AsbaTechs CRM for Windows/i })
    );
    await expect(btn.first()).toBeVisible();

    const href = await btn.first().getAttribute("href");
    expect(href).toBeTruthy();
    expect(href).toMatch(/github\.com|AsbaTechs|Setup|\.exe/i);
  });

  test("installer API redirects to a downloadable asset", async ({ request }) => {
    const res = await request.get("/api/desktop/installer", {
      maxRedirects: 0
    });

    // After deploy: 302 to GitHub. Before deploy: may 404 — assert when present.
    if (res.status() === 404) {
      test.skip(true, "API route not deployed on this host yet");
    }

    expect([301, 302, 307, 308]).toContain(res.status());
    const location = res.headers()["location"] ?? "";
    expect(location).toMatch(/github\.com|AsbaTechs|\.exe/i);
  });
});
