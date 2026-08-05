import { defineConfig } from "cypress";

const baseUrl =
  process.env.CYPRESS_BASE_URL?.trim() ||
  process.env.PLAYWRIGHT_BASE_URL?.trim() ||
  "https://asbatechs-crm-web.vercel.app";

export default defineConfig({
  e2e: {
    baseUrl,
    supportFile: "cypress/support/e2e.ts",
    specPattern: "cypress/e2e/**/*.cy.{js,jsx,ts,tsx}",
    video: false,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 20_000,
    requestTimeout: 30_000,
    viewportWidth: 1440,
    viewportHeight: 900,
    retries: { runMode: 1, openMode: 0 }
  },
  env: {
    adminEmail: process.env.E2E_ADMIN_EMAIL ?? "admin@crm.com",
    adminPassword: process.env.E2E_ADMIN_PASSWORD ?? "admin123"
  }
});
