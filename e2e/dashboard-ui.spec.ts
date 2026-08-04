import { expect, test, type APIRequestContext, type BrowserContext } from "@playwright/test";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@crm.com";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "admin123";

async function loginAsAdmin(request: APIRequestContext, context: BrowserContext) {
  const res = await request.post("/api/auth/login", {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
  });
  expect(res.ok(), `login failed: ${res.status()} ${await res.text()}`).toBeTruthy();
  const body = await res.json();
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
    }, body.token as string);
  }

  return body;
}

test.describe("Dashboard UI (authenticated)", () => {
  test("sidebar + stat cards render without horizontal overflow", async ({
    page,
    request,
    context
  }) => {
    test.setTimeout(90_000);
    await loginAsAdmin(request, context);

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });

    const desktopSidebar = page.getByTestId("app-sidebar-rail");
    await expect(desktopSidebar).toBeVisible({ timeout: 20_000 });
    await expect(desktopSidebar.getByText("AsbaTechs CRM")).toBeVisible();

    const sidebarNav = page
      .getByTestId("app-sidebar-nav")
      .or(page.locator('aside nav[aria-label="Main navigation"]'));
    await expect(sidebarNav.first()).toBeVisible({ timeout: 20_000 });
    await expect(
      sidebarNav.first().getByRole("link", { name: /Executive Dashboard/i })
    ).toBeVisible();
    await expect(sidebarNav.first().getByRole("link", { name: /All Leads/i })).toBeVisible();
    await expect(
      sidebarNav
        .first()
        .getByRole("link", { name: /Employees|Admin Control|Clients|Departments/i })
        .first()
    ).toBeVisible();

    const stats = page
      .getByTestId("dashboard-stat-cards")
      .or(page.locator(".portal-stat-grid, .metric-card").first());
    await expect(page.getByText(/Total leads/i).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Hot leads/i).first()).toBeVisible();
    await expect(page.getByText(/Sales leads/i).first()).toBeVisible();
    await expect(page.getByText(/Open shifts/i).first()).toBeVisible();
    await expect(stats.first()).toBeVisible();

    const layout = await page.evaluate(() => {
      const aside = document.querySelector("aside");
      const main = document.querySelector("main");
      const a = aside?.getBoundingClientRect();
      const m = main?.getBoundingClientRect();
      return {
        sideW: a ? Math.round(a.width) : 0,
        mainX: m ? Math.round(m.x) : 0,
        overflow: document.documentElement.scrollWidth > window.innerWidth + 2,
        brandTeal: getComputedStyle(document.documentElement)
          .getPropertyValue("--brand-teal")
          .trim()
      };
    });

    expect(layout.sideW).toBeGreaterThanOrEqual(240);
    expect(layout.mainX).toBeGreaterThanOrEqual(240);
    expect(layout.overflow).toBe(false);
    expect(layout.brandTeal.length).toBeGreaterThan(0);

    await expect(desktopSidebar).toHaveAttribute("data-collapsed", "false");
    await expect(desktopSidebar.getByText("Daily focus")).toBeVisible();

    const collapseToggle = page.getByTestId("sidebar-collapse-toggle");
    await expect(collapseToggle).toBeVisible();
    await collapseToggle.click();
    await expect(desktopSidebar).toHaveAttribute("data-collapsed", "true", {
      timeout: 5_000
    });
    await expect
      .poll(async () => {
        const box = await desktopSidebar.boundingBox();
        return box ? Math.round(box.width) : 0;
      })
      .toBeLessThanOrEqual(80);
    await expect(desktopSidebar.getByText("Daily focus")).toHaveCount(0);
    await expect(
      desktopSidebar.getByRole("link", { name: /Executive Dashboard/i })
    ).toBeVisible();

    await collapseToggle.click();
    await expect(desktopSidebar).toHaveAttribute("data-collapsed", "false", {
      timeout: 5_000
    });
    await expect(desktopSidebar.getByText("Daily focus")).toBeVisible();

    // Tablet: fixed sidebar hidden; header mobile menu should remain
    await page.setViewportSize({ width: 1100, height: 800 });
    await page.waitForTimeout(250);
    const tablet = await page.evaluate(() => {
      const aside = document.querySelector('[data-testid="app-sidebar-rail"]');
      const display = aside ? getComputedStyle(aside).display : "none";
      return { sideDisplay: display };
    });
    expect(tablet.sideDisplay).toBe("none");
  });
});
