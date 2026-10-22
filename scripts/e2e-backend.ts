/**
 * Starts the real backend for `bun run e2e:real` (Playwright's webServer runs this and waits
 * for <api>/ready). The mode comes from E2E_BACKEND:
 *
 *   source  (default) run gezcez/backend from a checkout with Bun, no Docker needed.
 *           E2E_BACKEND_DIR=<path> uses an existing checkout as is; otherwise the ref in
 *           e2e/backend-version is cloned (or updated) into node_modules/.cache/gezcez-backend.
 *   image   the published image ghcr.io/gezcez/backend:<E2E_BACKEND_TAG, default main>
 *           through e2e/docker-compose.e2e.yml
 *   docker-source  the same compose file, building the image from the git ref
 *
 * Every mode runs NODE_ENV=test on a fresh database: seeded e2e clients, memory mail with the
 * test mailbox, and the oauth app's origin as OAUTH_UI_URL and the only CORS origin.
 */
import { spawn, spawnSync, type ChildProcess } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const mode = process.env.E2E_BACKEND ?? "source"
const apiPort = process.env.E2E_API_PORT ?? "8080"
const apiUrl = process.env.E2E_API_URL ?? `http://localhost:${apiPort}`
const oauthUrl = process.env.E2E_OAUTH_URL ?? "http://localhost:5174"
const ref = (
  process.env.E2E_BACKEND_REF ?? fs.readFileSync(path.join(ROOT, "e2e/backend-version"), "utf8")
).trim()

const backendEnv = {
  NODE_ENV: "test",
  PORT: apiPort,
  HOST: "127.0.0.1",
  PUBLIC_API_URL: apiUrl,
  OAUTH_UI_URL: oauthUrl,
  CORS_ORIGINS: oauthUrl,
  RATE_LIMIT_SCALE: process.env.E2E_RATE_LIMIT_SCALE ?? "10",
  LOG_LEVEL: process.env.E2E_BACKEND_LOG_LEVEL ?? "warn",
  EMAIL_TRANSPORT: "memory",
}

function run(cmd: string, args: string[], cwd?: string) {
  const r = spawnSync(cmd, args, { cwd, stdio: "inherit" })
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")} exited with ${r.status}`)
}

function checkout(): string {
  if (process.env.E2E_BACKEND_DIR) return path.resolve(process.env.E2E_BACKEND_DIR)
  const dir = path.join(ROOT, "node_modules/.cache/gezcez-backend")
  if (!fs.existsSync(path.join(dir, ".git"))) {
    fs.mkdirSync(path.dirname(dir), { recursive: true })
    run("git", ["clone", "--depth", "1", "--branch", ref, "https://github.com/gezcez/backend.git", dir])
  } else {
    run("git", ["fetch", "--depth", "1", "origin", ref], dir)
    run("git", ["checkout", "--force", "FETCH_HEAD"], dir)
  }
  run("bun", ["install", "--frozen-lockfile"], dir)
  return dir
}

let child: ChildProcess
let cleanup: () => void = () => {}

if (mode === "source") {
  const dir = checkout()
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "gezcez-e2e-"))
  console.log(`[e2e-backend] ${dir} on ${apiUrl}, data in ${dataDir}`)
  child = spawn("bun", ["src/main.ts"], {
    cwd: dir,
    stdio: "inherit",
    env: { ...process.env, ...backendEnv, DATA_DIR: dataDir },
  })
  cleanup = () => fs.rmSync(dataDir, { recursive: true, force: true })
} else if (mode === "image" || mode === "docker-source") {
  const profile = mode === "image" ? "image" : "source"
  const compose = ["compose", "-f", path.join(ROOT, "e2e/docker-compose.e2e.yml"), "--profile", profile]
  const env = {
    ...process.env,
    E2E_API_URL: apiUrl,
    E2E_API_PORT: apiPort,
    E2E_OAUTH_URL: oauthUrl,
    E2E_BACKEND_REF: ref,
    E2E_BACKEND_TAG: process.env.E2E_BACKEND_TAG ?? (ref.startsWith("v") ? ref : "main"),
  }
  console.log(`[e2e-backend] docker compose profile ${profile} on ${apiUrl}`)
  child = spawn(
    "docker",
    [...compose, "up", ...(mode === "docker-source" ? ["--build"] : []), "--force-recreate"],
    {
      stdio: "inherit",
      env,
    },
  )
  cleanup = () => {
    spawnSync("docker", [...compose, "down", "--volumes"], { stdio: "inherit", env })
  }
} else {
  throw new Error(`E2E_BACKEND must be source, image or docker-source (got ${mode})`)
}

let stopping = false
function stop() {
  if (stopping) return
  stopping = true
  child.kill("SIGTERM")
}
process.on("SIGTERM", stop)
process.on("SIGINT", stop)
child.on("exit", (code) => {
  cleanup()
  process.exit(stopping ? 0 : (code ?? 1))
})
