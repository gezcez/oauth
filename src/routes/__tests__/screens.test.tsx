import { screen, waitFor } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { signInAs } from "@/mocks/db"
import { renderApp } from "@/test/render-app"

const publicScreens: [string, RegExp, RegExp][] = [
  ["/signin", /^Sign in$/, /^Giriş yap$/],
  ["/signup", /Create your gezcez account/, /Gezcez hesabınızı oluşturun/],
  ["/signin/password", /Sign in with a password/, /Şifreyle giriş yapın/],
  ["/signin/code", /Start again/, /Baştan başla/],
  ["/signup/profile", /Start again/, /Baştan başla/],
  ["/reset", /Reset your password/, /Şifrenizi sıfırlayın/],
  ["/reset/new", /Start again/, /Baştan başla/],
  ["/logout", /Sign out of gezcez on this browser\?/, /gezcez'den çıkış yapılsın mı\?/],
  ["/signed-out", /You're signed out/, /Çıkış yaptınız/],
  ["/banned", /This account can't sign in/, /Bu hesapla giriş yapılamıyor/],
  ["/pending-deletion", /scheduled for deletion/, /silinmek üzere/],
  ["/deletion-scheduled", /Your account will be deleted/, /Hesabınız silinecek/],
  ["/error?code=OAUTH_INVALID_REDIRECT_URI", /This sign-in link is broken/, /Bu giriş bağlantısı bozuk/],
  ["/error?code=OAUTH_INVALID_CLIENT", /We don't know this app/, /Bu uygulamayı tanımıyoruz/],
  ["/error?code=OAUTH_REQUEST_EXPIRED", /This sign-in took too long/, /Bu giriş çok uzun sürdü/],
  ["/error", /Something went wrong/, /Bir şeyler ters gitti/],
  ["/?app=dashboard", /out of date/, /sürümü eski/],
  ["/does-not-exist", /Page not found/, /Sayfa bulunamadı/],
]

const accountScreens: [string, RegExp, RegExp][] = [
  ["/account", /Hi, Ada Lovelace/, /Merhaba, Mert Yılmaz/],
  ["/account/profile", /^Profile$/, /^Profil$/],
  ["/account/email", /^Email$/, /^E-posta$/],
  ["/account/sessions", /^Devices$/, /^Cihazlar$/],
  ["/account/apps", /^Connected apps$/, /^Bağlı uygulamalar$/],
  ["/account/security", /^Security$/, /^Güvenlik$/],
  ["/account/privacy", /^Privacy$/, /^Gizlilik$/],
  ["/account/privacy/delete", /Delete your account/, /Hesabınızı silin/],
  ["/account/language", /^Language$/, /^Dil$/],
  ["/reauth?return=/account/security", /Confirm it's you/, /Siz olduğunuzu doğrulayın/],
]

async function heading() {
  return screen.findByRole("heading", { level: 1 }, { timeout: 4000 })
}

describe("every screen renders in both languages", () => {
  for (const [path, en, tr] of publicScreens) {
    it(`${path} (en, tr)`, async () => {
      const a = await renderApp(path, { locale: "en" })
      expect((await heading()).textContent).toMatch(en)
      expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
      a.unmount()
      await renderApp(path, { locale: "tr" })
      expect((await heading()).textContent).toMatch(tr)
    })
  }

  for (const [path, en, tr] of accountScreens) {
    it(`${path} signed in (en, tr)`, async () => {
      // The account's language wins on account pages: Ada is English, Mert is Turkish.
      signInAs("ada@example.com")
      const a = await renderApp(path, { locale: "en" })
      expect((await heading()).textContent).toMatch(en)
      a.unmount()
      signInAs("mert@example.com")
      // Sign-in screens (here /reauth) follow the UI language, not the account's.
      await renderApp(path, { locale: path.startsWith("/account") ? "en" : "tr" })
      await waitFor(async () => expect((await heading()).textContent).toMatch(tr))
    })
  }
})

describe("account guard", () => {
  it("sends signed-out visitors to /signin with a return path", async () => {
    const { router } = await renderApp("/account/privacy/delete")
    await waitFor(() => expect(router.state.location.pathname).toBe("/signin"))
    expect(router.state.location.search).toEqual({ return: "/account/privacy/delete" })
  })

  it("/ goes to /account when signed in and /signin otherwise", async () => {
    const a = await renderApp("/")
    await waitFor(() => expect(a.router.state.location.pathname).toBe("/signin"))
    a.unmount()
    signInAs("ada@example.com")
    const b = await renderApp("/")
    await waitFor(() => expect(b.router.state.location.pathname).toBe("/account"))
  })
})
