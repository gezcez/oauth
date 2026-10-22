import { defineConfig, devices } from "@playwright/test"

/**
 * Default run: the MSW build (`build:mock`) served by `vite preview` with the production
 * security headers, so every screen is reachable without a backend.
 *
 * The real-backend suite (e2e/real) has its own config: `bun run e2e:real`, see
 * playwright.real.config.ts.
 *
 * SCREENSHOTS=1 adds the `screenshots` project that writes PNGs to SCREENSHOT_DIR.
 */
const PORT = 5174
const BASE = `http://localhost:${PORT}`
const ci = Boolean(process.env.CI)
// WebKit projects are opt-in: not yet verified (no WebKit build in the dev container).
const allBrowsers = process.env.E2E_ALL_BROWSERS === "1"

export default defineConfig({
  testDir: ".",
  outputDir: "../test-results",
  fullyParallel: true,
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  workers: ci ? 2 : undefined,
  reporter: ci ? [["github"], ["html", { open: "never", outputFolder: "../playwright-report" }]] : [["list"]],
  timeout: 30_000,
  expect: { timeout: 7_000 },
  use: {
    baseURL: BASE,
    trace: "retain-on-failure",
    video: ci ? "retain-on-failure" : "off",
    locale: "en-GB",
  },
  projects: [
    { name: "chromium", testDir: "specs", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chrome", testDir: "specs", use: { ...devices["Pixel 7"] }, grepInvert: /@desktop-only/ },
    ...(allBrowsers
      ? [
          { name: "webkit", testDir: "specs", use: { ...devices["Desktop Safari"] } },
          {
            name: "mobile-safari",
            testDir: "specs",
            use: { ...devices["iPhone 15"] },
            grepInvert: /@desktop-only/,
          },
        ]
      : []),
    ...(process.env.SCREENSHOTS === "1"
      ? [{ name: "screenshots", testDir: "screenshots", use: { ...devices["Desktop Chrome"] } }]
      : []),
  ],
  webServer: {
    command: "bun run build:mock && bunx vite preview --mode mock --port 5174 --strictPort",
    cwd: "..",
    url: BASE,
    reuseExistingServer: !ci,
    timeout: 180_000,
  },
})
