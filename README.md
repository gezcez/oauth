# gezcez oauth

The identity UI for gezcez at **oauth.gezcez.com**. It covers sign-in, sign-up, password reset, the
OAuth consent and account-chooser screens, step-up re-authentication, logout, and the account
settings pages (profile, email, devices, connected apps, security, privacy, language).

It is a static single-page app. Every decision is made by the backend (`/v1/account/*`, `/v1/oauth/*`).
The SPA never builds a redirect to a client app itself. It only follows a `redirect_to` the API
returned (`followRedirect`) or an internal path checked by `safeInternalPath`
(`src/lib/navigation.ts`). A lint rule enforces this.

## Stack

Vite, React 19, TypeScript (strict), TanStack Router (file routes in `src/routes`) and TanStack
Query v5, Tailwind CSS v4 (brand tokens in `src/styles/tokens.css`, the same palette as
www.gezcez.com, light and dark), our own shadcn-style components in `src/components/ui`,
react-hook-form + zod, typed tr/en catalogs (`src/i18n`), openapi-fetch, MSW for the mock backend,
Vitest + Testing Library, Playwright, and Cloudflare Workers static assets (`wrangler.jsonc`).

## Run it

```sh
bun install
bun run dev:mock     # http://localhost:5174 against the in-browser mock backend (no API needed)
bun run dev          # against VITE_API_URL (see .env.example), e.g. a local backend on :3000
```

To reach a screen in mock mode, use the **Mock** panel in the bottom-left corner. It can sign in as any
seed account, open an `/authorize` request for each test client, make the session stale for step-up,
and reset the data. These magic values work:

| Input | Result |
| --- | --- |
| code `123456` | correct |
| code `000000` | expired |
| code `111111` | too many tries |
| any other code | wrong (attempts count down) |
| `ada@example.com` | existing account, password `correct horse battery` |
| `mert@example.com` | existing account, Turkish, no password |
| `banned@example.com` | suspended (shown after the code) |
| `deleting@example.com` | deletion scheduled (shown after the code) |
| `ratelimit@example.com` | rate limited for 75 s |
| `turnstile@example.com` | bot check failed |
| any other address | new account (sign-up profile step) |
| password `breached-password-123` | rejected as breached |

The mock clients are `dashboard` and `mobile` (first party), `e2e_client`, and `e2e_third_party`
("Transit Stats", third party, so it shows consent). For example:
`/authorize?client_id=dashboard&redirect_uri=https%3A%2F%2Fdash.gezcez.com%2Fauth%2Fcallback&response_type=code&scope=openid%20profile&state=x&code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&code_challenge_method=S256`

## Scripts

| Script | What it does |
| --- | --- |
| `typecheck`, `lint`, `format` | tsc, ESLint (with the local `no-location-assign` and `no-dangerously-set-inner-html` rules), Prettier |
| `test` | Vitest: units, i18n catalog parity, screen and flow tests against MSW, the headers file, and the PKCE vector |
| `build` / `build:mock` | production build / build with the mock backend baked in |
| `preview` | serves `dist/` on :5174 with the CSP and security headers from `public/_headers` |
| `e2e` | Playwright (Chromium desktop + Pixel 7) against `build:mock`, including axe checks in en/tr and light/dark |
| `screenshots` | writes every main screen in light/dark × desktop/mobile to `SCREENSHOT_DIR` (default `/mnt/project-files/revamp/screens/oauth`) |
| `e2e:real` | real-backend e2e (`e2e/real`, see below): backend from source by default, `e2e:real:image` for the ghcr image |
| `e2e:client` | the PKCE test client on :4710 on its own |
| `api:gen` / `api:check` | regenerate / check `src/api/schema.gen.ts` from `OPENAPI_SOURCE` (default staging `openapi.json`) |

Set `PLAYWRIGHT_BROWSERS_PATH` if your browsers live outside the default cache. WebKit projects are
opt-in with `E2E_ALL_BROWSERS=1` and have not been verified yet.

## API types

`src/api/schema.gen.ts` is generated from the backend's OpenAPI document. Endpoints the backend does
not publish yet are typed by hand in `src/api/schema.manual.ts`, each marked
`[backend: in progress]`, `[backend: missing]` or `[backend: not in plan]`. `src/api/schema.ts`
merges the two. When the backend publishes an endpoint, delete its manual entry and run `api:gen`.

## Security

- `public/_headers` sets a strict CSP (`style-src 'self'`, no inline scripts, `frame-ancestors 'none'`),
  HSTS, COOP/CORP, `Referrer-Policy: no-referrer` and `no-store`. `scripts/headers.test.ts` checks it.
  Because of the CSP, no dependency may inject `<style>` elements. The dialog, toasts and OTP input are
  our own for that reason, and the e2e fixture fails any test that logs a CSP violation.
- CSRF uses the `X-CSRF-Token` header from `GET /v1/account/csrf`, with one retry on `CSRF_INVALID`.
- Flow secrets (profile and reset tokens) are kept in memory only. Flow ids are kept in sessionStorage.

## Deploy

`.github/workflows/deploy.yml` deploys `main` to staging and a `v*` tag (or a manual run) to
production with `wrangler deploy`. It needs the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`
secrets and the `VITE_API_URL` and `VITE_TURNSTILE_SITE_KEY` variables per environment.

## End-to-end tests

- `bun run e2e`: Playwright against the MSW build (`build:mock`), no backend needed.
- `bun run e2e:real`: the specs in `e2e/real` against the real backend (oauth.md section 11).
  `e2e/playwright.real.config.ts` starts three servers on localhost:
  - the backend in `NODE_ENV=test` through `scripts/e2e-backend.ts`. `E2E_BACKEND=source` (default)
    runs a checkout with Bun: `E2E_BACKEND_DIR=<path>` uses yours, otherwise the ref in
    `e2e/backend-version` is cloned into `node_modules/.cache/gezcez-backend`.
    `E2E_BACKEND=image` runs `ghcr.io/gezcez/backend:<E2E_BACKEND_TAG>` and
    `E2E_BACKEND=docker-source` builds that image from the git ref, both through
    `e2e/docker-compose.e2e.yml`. `E2E_BACKEND=external` uses one already on `E2E_API_URL`.
  - this app, built with `VITE_API_URL` pointing at that backend and served by `vite preview`
    with the production headers (`PREVIEW_CONNECT_SRC` adds the API to `connect-src`).
  - the test client (`e2e/fixtures/test-client`, `bun run e2e:client`) on port 4710, which the
    backend's test seed registers for `e2e_client` and `e2e_third_party`. It builds PKCE and
    state, exchanges the code server-side, calls `/v1/me` and shows the result as JSON.

  Ports: `E2E_API_PORT` (8080), `E2E_OAUTH_PORT` (5174), `TEST_CLIENT_PORT` (4710). Rate
  limits are multiplied by `E2E_RATE_LIMIT_SCALE` (10). Codes come from the backend's test
  mailbox; Turnstile is stubbed in the browser (the backend has no secret in test mode).
  Chromium only: plain-http localhost works for the API's `__Host-` cookies there; WebKit needs
  the `*.localtest.me` plus TLS set-up described in oauth.md section 11.

## Backend gaps

Checked against the backend `rewrite` branch by the real e2e suite. Every endpoint in `backend.md`
7.1 that this UI calls is in `openapi.json` except these (typed by hand in `schema.manual.ts`):

- **Missing:** `GET|POST /v1/account/export`, `GET /v1/account/export/:id`,
  `GET /v1/account/export/:id/download`, `POST /v1/account/delete`, `POST /v1/account/delete/cancel`.
  `e2e/real/account-privacy.spec.ts` marks those flows fixme until they exist.
- **Not in the plan, but this UI needs them:**
  - `DELETE /v1/account/device-accounts/:sessionId` to forget a signed-out account on this device (the chooser's "Remove").
  - `decision: "deny"` must work without a session, so the banned page's "Back to app" can return
    `access_denied` (the backend's decision route requires a session).
- **Quirk:** auth request ids are `ar__<ULID>` (double underscore); the `req` search param accepts it.
