import { expect, test, type APIRequestContext, type BrowserContext } from "@playwright/test";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@crm.com";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "admin123";

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

test.describe("Dashboard UI (authenticated)", () => {
  test("overview, KPIs, charts, and attendance table without overflow", async ({
    page,
    request,
    context
  }) => {
    test.setTimeout(120_000);
    await loginAsAdmin(request, context);

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/dashboard?mode=daily", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });

    // Soft-skip if host is Vercel SSO / not the CRM app
    const title = await page.title();
    if (/vercel/i.test(title) && /log in/i.test(await page.locator("body").innerText().catch(() => ""))) {
      test.skip(true, "Host is Vercel SSO protected — use asbatechs-crm-web.vercel.app");
    }

    const desktopSidebar = page.getByTestId("app-sidebar-rail");
    await expect(desktopSidebar).toBeVisible({ timeout: 25_000 });
    await expect(desktopSidebar.getByText("AsbaTechs CRM")).toBeVisible();

    // Kalie-style overview header
    await expect(page.getByRole("heading", { name: /Dashboard overview/i })).toBeVisible({
      timeout: 20_000
    });
    await expect(page.getByText(/^Live$/).first()).toBeVisible();

    const stats = page.getByTestId("dashboard-stat-cards");
    await expect(stats).toBeVisible();
    await expect(stats.getByText(/Total leads/i)).toBeVisible();
    await expect(stats.getByText(/Hot leads/i)).toBeVisible();
    await expect(stats.getByText(/Sales leads/i)).toBeVisible();
    await expect(stats.getByText(/Open shifts/i)).toBeVisible();

    // Charts section
    await expect(page.getByRole("heading", { name: /Performance analytics/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Lead distribution|Lead mix/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Revenue overview|Sales performance/i })).toBeVisible();

    // Attendance command + agent health table (admin)
    await expect(page.getByRole("heading", { name: /Team attendance monitor/i })).toBeVisible({
      timeout: 25_000
    });

    const agentTable = page.getByTestId("agent-health-table");
    const agentShell = page.getByTestId("agent-health-table-shell");
    // Deploy may lag — accept either new testids or classic crm-table under agent health
    const table = agentTable.or(page.locator("table.crm-table").first());
    await expect(table.first()).toBeVisible({ timeout: 30_000 });
    await expect(table.first().locator("thead th").filter({ hasText: /Name/i })).toBeVisible();
    await expect(table.first().locator("thead th").filter({ hasText: /Status/i })).toBeVisible();
    await expect(table.first().locator("thead th").filter({ hasText: /Agent/i })).toBeVisible();

    if (await agentShell.count()) {
      await expect(agentShell).toBeVisible();
      const shellBox = await agentShell.boundingBox();
      expect(shellBox?.width ?? 0).toBeGreaterThan(200);
    }

    const layout = await page.evaluate(() => {
      const aside = document.querySelector('[data-testid="app-sidebar-rail"]');
      const main = document.querySelector("main");
      const tableEl = document.querySelector('[data-testid="agent-health-table"], table.crm-table');
      const a = aside?.getBoundingClientRect();
      const m = main?.getBoundingClientRect();
      const t = tableEl?.getBoundingClientRect();
      return {
        sideW: a ? Math.round(a.width) : 0,
        mainX: m ? Math.round(m.x) : 0,
        overflow: document.documentElement.scrollWidth > window.innerWidth + 2,
        brandTeal: getComputedStyle(document.documentElement)
          .getPropertyValue("--brand-teal")
          .trim(),
        brandFg: getComputedStyle(document.documentElement)
          .getPropertyValue("--brand-fg")
          .trim(),
        tableVisible: Boolean(t && t.width > 0 && t.height > 0)
      };
    });

    expect(layout.sideW).toBeGreaterThanOrEqual(240);
    expect(layout.mainX).toBeGreaterThanOrEqual(240);
    expect(layout.overflow).toBe(false);
    expect(layout.brandTeal.length).toBeGreaterThan(0);
    expect(layout.tableVisible).toBe(true);

    // Collapse rail still works
    const collapseToggle = page.getByTestId("sidebar-collapse-toggle");
    await expect(collapseToggle).toBeVisible();
    await collapseToggle.click();
    await expect(desktopSidebar).toHaveAttribute("data-collapsed", "true", { timeout: 5_000 });
    await collapseToggle.click();
    await expect(desktopSidebar).toHaveAttribute("data-collapsed", "false", { timeout: 5_000 });

    // Tablet: fixed sidebar hidden
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
