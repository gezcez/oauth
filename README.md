# gezcez oauth

Identity UI for gezcez (oauth.gezcez.com). Work in progress on the `rewrite` branch.

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

Endpoints this UI calls that the backend does not publish yet are hand-typed in
`src/api/schema.manual.ts`: data export (`/v1/account/export*`), account deletion
(`/v1/account/delete`, `/v1/account/delete/cancel`) and forgetting a signed-out account on
this device (`DELETE /v1/account/device-accounts/{sessionId}`, not in the backend plan).
