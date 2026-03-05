/**
 * Playwright configuration for E2E tests.
 *
 * These tests assume the API is running on http://localhost:3000
 * and the Vite dev server is running on http://localhost:5173.
 *
 * In CI, Playwright can launch both servers automatically via webServer.
 * Locally, you can either run them yourself or let Playwright start them.
 */

import { defineConfig, devices } from "@playwright/test";

// Allow overriding the base URL in CI or different environments.
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:5173";
const slowMo = process.env.PW_SLOWMO ? Number(process.env.PW_SLOWMO) : 0;

export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  reporter: [["list"], ["html", { outputFolder: "playwright-report" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    launchOptions: {
      slowMo,
    },
  },
  webServer: [
    {
      command: "npm run dev",
      url: "http://localhost:3000/health",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "npm run dev:ui",
      url: "http://localhost:5173",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
