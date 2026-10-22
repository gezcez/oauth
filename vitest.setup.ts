import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterAll, afterEach, beforeAll } from "vitest"
import { server } from "@/mocks/node"
import { resetDb } from "@/mocks/db"
import { invalidateCsrfToken } from "@/lib/csrf"
import { secretStore } from "@/lib/flow-memory"

// jsdom lacks these; Radix primitives and input-otp use them.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver
Element.prototype.scrollIntoView ??= function scrollIntoView() {}
Element.prototype.hasPointerCapture ??= () => false
Element.prototype.releasePointerCapture ??= () => {}
document.elementFromPoint ??= () => null

beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
afterEach(() => {
  cleanup()
  server.resetHandlers()
  resetDb()
  invalidateCsrfToken()
  secretStore.clear()
  sessionStorage.clear()
  localStorage.clear()
})
afterAll(() => server.close())
