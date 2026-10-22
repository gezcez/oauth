import { defineConfig, devices } from "@playwright/test"

/**
 * Default run: the MSW build (`build:mock`) served by `vite preview` with the production
 * security headers, so every screen is reachable without a backend.
 *
 * E2E_REAL_BACKEND=1 adds the `real` project: the published ghcr.io/gezcez/backend image
 * (tag in e2e/backend-version) from docker-compose.e2e.yml plus the test client. It is
 * skipped until that image exists.
 *
 * SCREENSHOTS=1 adds the `screenshots` project that writes PNGs to SCREENSHOT_DIR.
 *
 * VISUAL=1 runs only the visual regression projects (`visual-desktop`, `visual-mobile`), which
 * compare every screen against the baselines in e2e/visual/__screenshots__ (README "Visual regression").
 */
// E2E_PORT lets several checkouts run the mock suite side by side. The mock API lives on the same
// origin (CSP connect-src 'self'), so the build is pointed at the same port.
const PORT = Number(process.env.E2E_PORT ?? 5174)
const BASE = `http://localhost:${PORT}`
const ci = Boolean(process.env.CI)
const real = process.env.E2E_REAL_BACKEND === "1"
// WebKit projects are opt-in: not yet verified (no WebKit build in the dev container).
const allBrowsers = process.env.E2E_ALL_BROWSERS === "1"
const visual = process.env.VISUAL === "1"

// One size per form factor at a 1x pixel ratio: small baselines and no fractional-scale
// anti-aliasing noise. The mobile size matches the screens/oauth captures.
const visualProjects = [
  {
    name: "visual-desktop",
    testDir: "visual",
    use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 860 }, deviceScaleFactor: 1 },
  },
  {
    name: "visual-mobile",
    testDir: "visual",
    use: {
      ...devices["Pixel 7"],
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 1,
      isMobile: true,
      hasTouch: true,
    },
  },
]

export default defineConfig({
  testDir: ".",
  outputDir: "../test-results",
  fullyParallel: true,
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  workers: ci ? 2 : undefined,
  reporter: ci ? [["github"], ["html", { open: "never", outputFolder: "../playwright-report" }]] : [["list"]],
  timeout: 30_000,
  expect: {
    timeout: 7_000,
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      scale: "css",
      // Per-pixel colour tolerance stays at the default; allow a handful of anti-aliased pixels.
      maxDiffPixelRatio: 0.0005,
    },
  },
  // No platform suffix: baselines are recorded on Linux (CI's ubuntu-24.04 or the Playwright image).
  snapshotPathTemplate: "{testDir}/__screenshots__/{projectName}/{arg}{ext}",
  use: {
    baseURL: BASE,
    trace: "retain-on-failure",
    video: ci ? "retain-on-failure" : "off",
    locale: "en-GB",
  },
  projects: visual
    ? visualProjects
    : [
        { name: "chromium", testDir: "specs", use: { ...devices["Desktop Chrome"] } },
        {
          name: "mobile-chrome",
          testDir: "specs",
          use: { ...devices["Pixel 7"] },
          grepInvert: /@desktop-only/,
        },
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
        ...(real
          ? [
              {
                name: "real",
                testDir: "real",
                use: { ...devices["Desktop Chrome"], ignoreHTTPSErrors: true },
              },
            ]
          : []),
      ],
  webServer: real
    ? undefined
    : {
        command: `VITE_API_URL=${BASE} bun run build:mock && bunx vite preview --mode mock --port ${PORT} --strictPort`,
        cwd: "..",
        url: BASE,
        reuseExistingServer: !ci,
        timeout: 180_000,
      },
})
