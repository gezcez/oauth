import type { QueryClient } from "@tanstack/react-query"
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router"
import { lazy, Suspense } from "react"
import { NotFoundPage } from "@/components/not-found-page"
import { OfflineBanner } from "@/components/offline-banner"
import { RouteFocus } from "@/components/route-focus"
import { Toaster } from "@/components/ui/toaster"
import { env } from "@/env"
import { useI18n } from "@/i18n"

const MockPanel = env.isMock ? lazy(() => import("@/mocks/panel")) : null

export interface RouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
  notFoundComponent: NotFoundPage,
})

function RootComponent() {
  const { t } = useI18n()
  return (
    <>
      <a
        href="#main"
        className="sr-only z-50 rounded-full bg-primary px-4 py-2 font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        {t("common.skipToContent")}
      </a>
      <OfflineBanner />
      <RouteFocus />
      <Outlet />
      <Toaster />
      {MockPanel ? (
        <Suspense fallback={null}>
          <MockPanel />
        </Suspense>
      ) : null}
    </>
  )
}
