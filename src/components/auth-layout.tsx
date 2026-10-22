import type { ReactNode } from "react"
import { Logo } from "./brand/logo"
import { LanguageSwitch } from "./language-switch"
import { SiteFooter } from "./site-footer"

/** Centered single-card layout for every sign-in screen (oauth.md 7.3). */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="mx-auto w-full max-w-md flex-1 px-4 pt-6 sm:px-6 sm:pt-12">
        <header className="mb-6 flex items-center justify-between sm:mb-8">
          <a
            href="https://www.gezcez.com"
            className="rounded-lg focus-visible:outline-2 focus-visible:outline-focus"
          >
            <Logo />
          </a>
          <LanguageSwitch />
        </header>
        <main id="main" className="rounded-2xl bg-surface p-6 ring-1 ring-line sm:p-8">
          {children}
        </main>
      </div>
      <SiteFooter />
    </div>
  )
}
