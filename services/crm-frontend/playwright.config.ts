import { defineConfig, devices } from "@playwright/test";

/**
 * HU-06.4 (IUDCYGI-40) — configuración de Playwright para los tests E2E del CRM.
 *
 * Por default los tests corren contra `npm run preview` (build estático).
 * Para tests que requieren backend, usar la suite `e2e-stack` y levantar el
 * compose antes (`make up`).
 *
 * Ejecución:
 *   npm run test:e2e          → suite estática (rápida, no necesita backend)
 *   npm run test:e2e:stack    → suite contra stack levantado
 */
export default defineConfig({
  testDir: "tests/e2e",
  outputDir: "tests/e2e/.results",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [
    ["html", { outputFolder: "tests/e2e/.report", open: "never" }],
    ["list"],
  ],
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: "chromium-static",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /smoke|render|form|accessibility/,
    },
    {
      name: "chromium-stack",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /stack/,
      grep: process.env.CI ? /@stack/ : undefined,
    },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "npm run preview -- --port 4173 --strictPort",
        port: 4173,
        timeout: 60_000,
        reuseExistingServer: !process.env.CI,
      },
});
