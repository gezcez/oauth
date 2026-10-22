import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import path from "node:path"
import { execSync } from "node:child_process"
import fs from "node:fs"
import type { Plugin } from "vite"

function buildId(): string {
  if (process.env.VITE_BUILD_ID) return process.env.VITE_BUILD_ID
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim()
  } catch {
    return "dev"
  }
}

/**
 * MSW's service worker is served only in mock mode (dev:mock, build:mock for e2e and PR
 * previews), straight from node_modules, so it never ships in a production build.
 */
function mockServiceWorker(enabled: boolean): Plugin {
  const file = path.resolve(import.meta.dirname, "node_modules/msw/lib/mockServiceWorker.js")
  return {
    name: "gezcez:mock-service-worker",
    configureServer(server) {
      if (!enabled) return
      server.middlewares.use("/mockServiceWorker.js", (_req, res) => {
        res.setHeader("Content-Type", "application/javascript")
        res.end(fs.readFileSync(file))
      })
    },
    configurePreviewServer(server) {
      if (!enabled) return
      server.middlewares.use("/mockServiceWorker.js", (_req, res) => {
        res.setHeader("Content-Type", "application/javascript")
        res.end(fs.readFileSync(file))
      })
    },
    generateBundle() {
      if (!enabled) return
      this.emitFile({ type: "asset", fileName: "mockServiceWorker.js", source: fs.readFileSync(file, "utf8") })
    },
  }
}

/**
 * `vite preview` serves the production security headers from public/_headers so e2e runs
 * catch CSP violations. upgrade-insecure-requests and report-to are dropped on plain-http
 * localhost; connect-src keeps 'self' (the MSW build talks to its own origin).
 */
function previewSecurityHeaders(): Plugin {
  return {
    name: "gezcez:preview-security-headers",
    configurePreviewServer(server) {
      const text = fs.readFileSync(path.resolve(import.meta.dirname, "public/_headers"), "utf8")
      const block = text.split(/\n(?=\/)/).find((b) => b.startsWith("/*")) ?? ""
      const headers = block
        .split("\n")
        .slice(1)
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#") && l.includes(": "))
        .map((l) => [l.slice(0, l.indexOf(": ")), l.slice(l.indexOf(": ") + 2)] as const)
        .filter(([k]) => k !== "Strict-Transport-Security" && k !== "Reporting-Endpoints")
        .map(([k, v]) => [k, k === "Content-Security-Policy" ? v.replace(/;\s*upgrade-insecure-requests/, "").replace(/;\s*report-to \w+/, "") : v] as const)
      server.middlewares.use((req, res, next) => {
        const isAsset = req.url?.startsWith("/assets/")
        for (const [k, v] of headers) if (!(isAsset && k === "Cache-Control")) res.setHeader(k, v)
        next()
      })
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [
    mockServiceWorker(mode === "mock"),
    previewSecurityHeaders(),
    tanstackRouter({ target: "react", autoCodeSplitting: true, routeFileIgnorePattern: "\\.test\\.tsx?$" }),
    react(),
    tailwindcss(),
  ],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  define: { __BUILD_ID__: JSON.stringify(buildId()) },
  server: { port: 5174, strictPort: true },
  preview: { port: 5174, strictPort: true },
  build: { sourcemap: true, target: "es2022" },
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "eslint-rules/**/*.test.ts", "scripts/**/*.test.ts"],
    css: false,
    testTimeout: 20_000,
  },
}))
