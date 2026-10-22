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
| `e2e:real:up`, `e2e:real`, `e2e:real:down` | real-backend e2e: `ghcr.io/gezcez/backend` (tag in `e2e/backend-version`) behind Caddy on `*.localtest.me` with the PKCE test client in `e2e/fixtures/test-client`. Skipped until an image is published |
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

## Backend gaps

The UI is built against `backend.md` 7.1. Here is what the backend branch was missing when this was
written (it is also marked in `schema.manual.ts`):

- **Not in openapi.json yet (controllers exist):** `GET /v1/account/csrf`, `GET /v1/account/session`,
  `GET /v1/account/device-accounts`, `POST /v1/account/session/switch`,
  `POST /v1/account/email/{start,resend,verify}`, `POST /v1/account/signup/complete`.
- **Missing:**
  - `POST /v1/account/password/login`, `POST /v1/account/password/reset`, `POST /v1/account/reauth`
  - `GET|PATCH /v1/account/profile`, `POST /v1/account/email/change`, `POST /v1/account/email/change/verify`
  - `GET /v1/account/sessions`, `DELETE /v1/account/sessions/:id`, `POST /v1/account/sessions/revoke-others`
  - `GET /v1/account/apps`, `DELETE /v1/account/apps/:clientId`
  - `GET /v1/account/security`, `PUT|DELETE /v1/account/password`
  - `GET|PATCH /v1/account/privacy`, `GET|POST /v1/account/export`, `GET /v1/account/export/:id`, `GET /v1/account/export/:id/download`
  - `POST /v1/account/delete`, `POST /v1/account/delete/cancel`
  - `POST /v1/oauth/authorize`, `GET /v1/oauth/authorize/:id`, `POST /v1/oauth/authorize/:id/continue`, `POST /v1/oauth/authorize/:id/decision`
  - `POST /v1/oauth/logout`
- **Not in the plan, but this UI needs them:**
  - `DELETE /v1/account/device-accounts/:sessionId` to forget a signed-out account on this device (the chooser's "Remove").
  - `decision: "deny"` must work without a session, so the banned page's "Back to app" can return `access_denied`.
  - `POST /v1/account/email/resend` must also accept the email-change flow.
