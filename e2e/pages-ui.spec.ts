import { expect, test, type APIRequestContext, type BrowserContext } from "@playwright/test";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@crm.com";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "admin123";

const STAFF_PAGES = [
  { path: "/dashboard", heading: /Dashboard overview/i },
  { path: "/leads", heading: /All leads/i },
  { path: "/leads/hot", heading: /Hot leads/i },
  { path: "/leads/sales", heading: /Sales leads/i },
  { path: "/attendance", heading: /Attendance/i },
  { path: "/work-updates", heading: /Work updates/i },
  { path: "/users", heading: /Employee directory/i },
  { path: "/settings/departments", heading: /Departments/i },
  { path: "/settings/clients", heading: /Client portal/i },
  { path: "/admin/overview", heading: /Admin control/i },
  { path: "/account", heading: /^Account$/i }
] as const;

async function loginAsAdmin(request: APIRequestContext, context: BrowserContext) {
  const res = await request.post("/api/auth/login", {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
  });
  const bodyText = await res.text();
  if (res.status() === 401 && /Protected deployment|vercel_auth/i.test(bodyText)) {
    test.skip(true, "Host is Vercel SSO protected — use https://asbatechs-crm-web.vercel.app");
  }
  expect(res.ok(), `login failed: ${res.status()} ${bodyText}`).toBeTruthy();
  const body = JSON.parse(bodyText) as { token?: string };
  expect(body.token).toBeTruthy();

  const state = await request.storageState();
  await context.addCookies(state.cookies);

  if (body.token) {
    await context.addInitScript((token: string) => {
      try {
        localStorage.setItem("crm_token", token);
      } catch {
        /* ignore */
      }
    }, body.token);
  }

  return body;
}

test.describe("Staff pages UI smoke (authenticated)", () => {
  test("key pages render headings without horizontal overflow", async ({
    page,
    request,
    context
  }) => {
    test.setTimeout(180_000);
    await loginAsAdmin(request, context);
    await page.setViewportSize({ width: 1440, height: 900 });

    for (const entry of STAFF_PAGES) {
      await page.goto(entry.path, { waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(
        (url) => {
          const pathname = new URL(url).pathname.replace(/\/$/, "") || "/";
          return pathname === entry.path;
        },
        { timeout: 20_000 }
      );

      await expect(page.getByRole("heading", { name: entry.heading }).first()).toBeVisible({
        timeout: 25_000
      });

      const layout = await page.evaluate(() => {
        const overflow =
          document.documentElement.scrollWidth > window.innerWidth + 4;
        const brandTeal = getComputedStyle(document.documentElement)
          .getPropertyValue("--brand-teal")
          .trim();
        return { overflow, brandTeal };
      });

      expect(layout.overflow, `${entry.path} should not overflow horizontally`).toBe(false);
      expect(layout.brandTeal.length).toBeGreaterThan(0);
    }

    // Sidebar still present on last page
    await expect(page.getByTestId("app-sidebar-rail")).toBeVisible();
  });
});
