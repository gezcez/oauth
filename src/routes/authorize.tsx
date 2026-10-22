import { createFileRoute } from "@tanstack/react-router"
import { useEffect, useRef, useState } from "react"
import { z } from "zod"
import { FullPageSpinner } from "@/components/full-page-spinner"
import { startAuthorize, useDispatchNext } from "@/features/authorize/api"
import { useAuthRequest } from "@/features/session/use-auth-request"
import { ErrorPage } from "@/components/error-page"
import { useI18n } from "@/i18n"
import { isOAuthPageError, toGezcezError } from "@/lib/errors"
import { replaceUrl } from "@/lib/navigation"
import { reqParam } from "@/lib/search"
import { useNavigate } from "@tanstack/react-router"
import { fromUiLocales } from "@/lib/locale"

/**
 * /authorize: either the raw OAuth query from a client (POSTed untouched to the backend) or
 * `?req=ar_...` when resuming. The SPA never inspects client_id, redirect_uri or state itself.
 */
export const Route = createFileRoute("/authorize")({
  validateSearch: z.looseObject({ req: reqParam }),
  component: AuthorizePage,
})

function rawParams(): Record<string, string> {
  const out: Record<string, string> = {}
  new URLSearchParams(window.location.search).forEach((v, k) => {
    if (k !== "req") out[k] = v
  })
  return out
}

function AuthorizePage() {
  const { req } = Route.useSearch()
  return req ? <Resume req={req} /> : <Start />
}

function Start() {
  const dispatch = useDispatchNext()
  const navigate = useNavigate()
  const { t, setLocale } = useI18n()
  const [client, setClient] = useState<string | null>(null)
  const [fatal, setFatal] = useState<unknown>(null)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    const params = rawParams()
    const l = fromUiLocales(params.ui_locales)
    if (l) setLocale(l, { persist: false })
    startAuthorize(params)
      .then(async (snap) => {
        setClient(snap.client.name)
        // Drop the raw OAuth params from the address bar so reload resumes instead of retrying.
        replaceUrl(`/authorize?req=${encodeURIComponent(snap.request_id)}`)
        await dispatch(snap.next, snap.request_id, snap.redirect_to)
      })
      .catch((e) => {
        const err = toGezcezError(e)
        if (isOAuthPageError(err.code)) {
          replaceUrl(`/error?code=${err.code}`)
          void navigate({ to: "/error", search: { code: err.code, ref: err.reference }, replace: true })
        } else {
          setFatal(err)
        }
      })
  }, [dispatch, navigate, setLocale])

  if (fatal) return <ErrorPage error={fatal as Error} reset={() => {}} />
  return (
    <FullPageSpinner
      label={client ? t("auth.authorize.connecting", { client }) : t("auth.authorize.connectingGeneric")}
    />
  )
}

function Resume({ req }: { req: string }) {
  const { t } = useI18n()
  const q = useAuthRequest(req)
  const dispatch = useDispatchNext()
  const done = useRef(false)
  useEffect(() => {
    if (!q.data || done.current) return
    done.current = true
    void dispatch(q.data.next, q.data.request_id, q.data.redirect_to)
  }, [q.data, dispatch])
  if (q.error && !isOAuthPageError(toGezcezError(q.error).code))
    return <ErrorPage error={q.error} reset={() => {}} />
  return (
    <FullPageSpinner
      label={
        q.data
          ? t("auth.authorize.connecting", { client: q.data.client.name })
          : t("auth.authorize.connectingGeneric")
      }
    />
  )
}
