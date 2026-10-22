import { defineConfig, devices } from "@playwright/test"

/**
 * `bun run e2e:real`: the e2e/real specs against the real backend (oauth.md section 11).
 *
 * Three web servers, all on localhost so the API's host-only `__Host-` cookies are same-site
 * with the oauth app (Chromium treats http://localhost as a secure context):
 *   - the backend in NODE_ENV=test (scripts/e2e-backend.ts; E2E_BACKEND=source|image|docker-source,
 *     or E2E_BACKEND=external to use one that is already running on E2E_API_URL)
 *   - the oauth app, a production build pointed at that API, served by `vite preview` with the
 *     production security headers
 *   - the test client (e2e/fixtures/test-client) on 4710, the port the backend seed registers
 *
 * Ports: E2E_API_PORT (8080), E2E_OAUTH_PORT (5174), TEST_CLIENT_PORT (4710; the seeded
 * post-logout URI is http://localhost:4710/, so change it only if you skip logout.spec).
 * Chromium only: WebKit refuses Secure cookies over plain-http localhost, so a WebKit run needs
 * the *.localtest.me + Caddy TLS set-up from oauth.md section 11.
 */
const ci = Boolean(process.env.CI)
const apiPort = process.env.E2E_API_PORT ?? "8080"
const oauthPort = process.env.E2E_OAUTH_PORT ?? "5174"
const clientPort = process.env.TEST_CLIENT_PORT ?? "4710"
const API = process.env.E2E_API_URL ?? `http://localhost:${apiPort}`
const OAUTH = `http://localhost:${oauthPort}`
const CLIENT = `http://localhost:${clientPort}`
const backend = process.env.E2E_BACKEND ?? "source"
/** E2E_REUSE=1 keeps an oauth preview and test client you already started (faster local loops). */
const reuse = process.env.E2E_REUSE === "1"

const shared = { E2E_API_URL: API, E2E_API_PORT: apiPort, E2E_OAUTH_URL: OAUTH, TEST_CLIENT_PORT: clientPort }
for (const [k, v] of Object.entries(shared)) process.env[k] = v

export default defineConfig({
  testDir: "real",
  outputDir: "../test-results/real",
  fullyParallel: true,
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  workers: ci ? 2 : 4,
  reporter: ci
    ? [["github"], ["html", { open: "never", outputFolder: "../playwright-report/real" }]]
    : [["list"]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: OAUTH,
    trace: "retain-on-failure",
    video: ci ? "retain-on-failure" : "off",
    locale: "en-GB",
  },
  projects: [
    { name: "real-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "real-pixel", use: { ...devices["Pixel 7"] }, grep: /@mobile/ },
  ],
  webServer: [
    ...(backend === "external"
      ? []
      : [
          {
            command: "bun scripts/e2e-backend.ts",
            cwd: "..",
            url: `${API}/ready`,
            env: { ...shared, E2E_BACKEND: backend },
            reuseExistingServer: false,
            timeout: 300_000,
            stdout: "pipe" as const,
          },
        ]),
    {
      command: `bunx vite build --outDir dist-e2e && bunx vite preview --outDir dist-e2e --port ${oauthPort} --strictPort`,
      cwd: "..",
      url: OAUTH,
      env: { VITE_API_URL: API, VITE_ENV: "test", VITE_API_MODE: "live", PREVIEW_CONNECT_SRC: API },
      reuseExistingServer: reuse,
      timeout: 180_000,
    },
    {
      command: "bun e2e/fixtures/test-client/server.ts",
      cwd: "..",
      url: `${CLIENT}/health`,
      env: shared,
      reuseExistingServer: reuse,
      timeout: 30_000,
    },
  ],
})
