import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router"
import { sessionQuery } from "@/api/queries"
import { Logo } from "@/components/brand/logo"
import { SiteFooter } from "@/components/site-footer"
import { AccountMenu } from "@/features/session/account-menu"
import { useI18n } from "@/i18n"
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
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link to="/account" className="rounded-lg focus-visible:outline-2 focus-visible:outline-focus">
            <Logo />
          </Link>
          <AccountMenu account={account} />
        </div>
      </header>
      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-10 md:grid md:grid-cols-[13rem_1fr] md:gap-10">
        <nav
          aria-label={t("account.nav.label")}
          className="-mx-4 mb-6 overflow-x-auto px-4 md:mx-0 md:mb-0 md:overflow-visible md:px-0"
        >
          <ul className="flex gap-2 md:sticky md:top-24 md:flex-col md:gap-1">
            {NAV.map((n) => (
              <li key={n.to} className="shrink-0">
                <Link
                  to={n.to}
                  activeOptions={{ exact: n.exact ?? false }}
                  className="inline-flex h-11 items-center rounded-full px-4 text-sm font-semibold whitespace-nowrap text-muted ring-1 ring-line hover:text-foreground focus-visible:outline-2 focus-visible:outline-focus md:flex md:ring-0 data-[status=active]:bg-primary data-[status=active]:text-primary-foreground data-[status=active]:ring-primary"
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
