import { QueryClientProvider } from "@tanstack/react-query"
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router"
import { render } from "@testing-library/react"
import { I18nProvider, type Locale } from "@/i18n"
import { createAppRouter, createQueryClient } from "@/router"

/** Renders the whole app (real routes, real API client, MSW handlers) at `path`. */
export async function renderApp(path: string, opts: { locale?: Locale } = {}) {
  const queryClient = createQueryClient()
  const history = createMemoryHistory({ initialEntries: [path] })
  const router = createAppRouter(queryClient, history)
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider initial={opts.locale ?? "en"}>
        <RouterProvider router={router} />
      </I18nProvider>
    </QueryClientProvider>,
  )
  await router.load()
  return { ...utils, router, queryClient, history }
}
