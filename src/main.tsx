import { QueryClientProvider } from "@tanstack/react-query"
import { RouterProvider } from "@tanstack/react-router"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { env } from "./env"
import { I18nProvider } from "./i18n"
import { createAppRouter, createQueryClient } from "./router"
import "./styles.css"

async function boot() {
  if (env.isMock) {
    const { startMockWorker } = await import("./mocks/browser")
    await startMockWorker()
  }
  const queryClient = createQueryClient()
  const router = createAppRouter(queryClient)
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <I18nProvider>
          <RouterProvider router={router} />
        </I18nProvider>
      </QueryClientProvider>
    </StrictMode>,
  )
}

void boot()
