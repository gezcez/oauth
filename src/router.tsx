import { QueryClient } from "@tanstack/react-query"
import { createRouter, type RouterHistory } from "@tanstack/react-router"
import { ErrorPage } from "@/components/error-page"
import { NotFoundPage } from "@/components/not-found-page"
import { isGezcezError } from "@/lib/errors"
import { routeTree } from "./routeTree.gen"

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: (count, err) => {
          if (isGezcezError(err) && err.status >= 400 && err.status < 500) return false
          return count < 2
        },
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false },
    },
  })
}

export function createAppRouter(queryClient: QueryClient, history?: RouterHistory) {
  return createRouter({
    routeTree,
    context: { queryClient },
    history,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: ErrorPage,
    defaultNotFoundComponent: NotFoundPage,
    scrollRestoration: true,
  })
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>
  }
}
