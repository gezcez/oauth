import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router"
import { useEffect, useRef, useState } from "react"
import { sessionQuery } from "@/api/queries"
import { Logo } from "@/components/brand/logo"
import { SiteFooter } from "@/components/site-footer"
import { AccountMenu } from "@/features/session/account-menu"
import { useI18n } from "@/i18n"
import { cn } from "@/lib/cn"
import type { TKey } from "@/i18n/types"
import { useAccountLocale } from "@/features/account/use-account-locale"

export const Route = createFileRoute("/account")({
  beforeLoad: async ({ context, location }) => {
    const session = await context.queryClient.fetchQuery({ ...sessionQuery, staleTime: 60_000 }) // refetches once invalidated (sign-in, sign-out)
    if (!session) {
      throw redirect({ to: "/signin", search: { return: location.href }, replace: true })
    }
    return { session }
  },
  component: AccountLayout,
})

const NAV: { to: string; label: TKey; exact?: boolean }[] = [
  { to: "/account", label: "account.nav.overview", exact: true },
  { to: "/account/profile", label: "account.nav.profile" },
  { to: "/account/email", label: "account.nav.email" },
  { to: "/account/sessions", label: "account.nav.sessions" },
  { to: "/account/apps", label: "account.nav.apps" },
  { to: "/account/security", label: "account.nav.security" },
  { to: "/account/privacy", label: "account.nav.privacy" },
  { to: "/account/language", label: "account.nav.language" },
]

function AccountLayout() {
  const { t } = useI18n()
  const ctx = Route.useRouteContext()
  const session = useQuery(sessionQuery)
  const account = session.data?.account ?? ctx.session.account
  useAccountLocale(account.locale, session.data?.session.id)
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const navRef = useRef<HTMLElement>(null)
  const [moreRight, setMoreRight] = useState(false)

  // Mobile: the nav is a horizontal pill row. Keep the active pill in view (centred) and fade the
  // right edge while more pills are hidden there. Scrolls the row only, never the page.
  const updateFade = () => {
    const nav = navRef.current
    if (nav) setMoreRight(nav.scrollLeft + nav.clientWidth < nav.scrollWidth - 1)
  }
  useEffect(() => {
    const nav = navRef.current
    const active = nav?.querySelector<HTMLElement>('[aria-current="page"]')
    if (nav && active && nav.scrollWidth > nav.clientWidth) {
      nav.scrollLeft = active.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2
    }
    updateFade()
  }, [pathname])

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link
            to="/account"
            className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            <Logo />
          </Link>
          <AccountMenu account={account} />
        </div>
      </header>
      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-10 md:grid md:grid-cols-[13rem_1fr] md:gap-10">
        <nav
          ref={navRef}
          onScroll={updateFade}
          aria-label={t("account.nav.label")}
          className={cn(
            "relative -mx-4 mb-5 snap-x overflow-x-auto px-4 py-1 md:mx-0 md:mb-0 md:snap-none md:overflow-visible md:px-0 md:py-0",
            moreRight && "[mask-image:linear-gradient(to_right,#000_85%,transparent)] md:[mask-image:none]",
          )}
        >
          <ul className="flex gap-2 md:sticky md:top-24 md:flex-col md:gap-1">
            {NAV.map((n) => (
              <li key={n.to} className="shrink-0 snap-start">
                <Link
                  to={n.to}
                  activeOptions={{ exact: n.exact ?? false }}
                  className="inline-flex h-11 items-center rounded-full px-4 text-sm font-semibold whitespace-nowrap text-muted ring-1 ring-line hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus md:flex md:ring-0 data-[status=active]:bg-primary data-[status=active]:text-primary-foreground data-[status=active]:ring-primary"
                  activeProps={{ "aria-current": "page" }}
                >
                  {t(n.label)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <main id="main" className="mx-auto w-full max-w-3xl min-w-0">
          <Outlet />
        </main>
      </div>
      <SiteFooter />
    </div>
  )
}
