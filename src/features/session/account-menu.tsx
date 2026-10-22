import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import { ArrowLeftRight, ChevronDown, LogOut, MonitorX, Plus } from "lucide-react"
import { useState } from "react"
import { deviceAccountsQuery } from "@/api/queries"
import type { AccountSummary } from "@/api/schema"
import { Avatar } from "@/components/brand/number-badge"
import { FormError } from "@/components/form-error"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toaster"
import { useI18n } from "@/i18n"
import { invalidateCsrfToken } from "@/lib/csrf"
import { logout, switchSession } from "./api"

export function AccountMenu({ account }: { account: AccountSummary }) {
  const { t } = useI18n()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [switching, setSwitching] = useState(false)
  const out = useMutation({
    mutationFn: (scope: "session" | "device") => logout({ scope }),
    onSuccess: async () => {
      invalidateCsrfToken()
      qc.clear()
      await navigate({ to: "/signed-out", replace: true })
    },
    onError: (e) => toast.error(String((e as Error).message)),
  })
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={t("account.menu.label", { name: account.display_name })}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-surface py-1 pr-3 pl-1 ring-1 ring-line hover:ring-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          <Avatar initials={account.avatar_initials} decorative />
          <span className="hidden max-w-40 truncate text-sm font-semibold sm:inline">
            {account.display_name}
          </span>
          <ChevronDown className="size-4 text-subtle" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel className="flex items-center gap-3 px-3 py-2">
            <Avatar initials={account.avatar_initials} className="size-10" />
            <span className="min-w-0">
              <span className="block truncate font-semibold">{account.display_name}</span>
              <span className="block truncate text-sm text-muted">
                {account.email ?? account.email_masked}
              </span>
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setSwitching(true)}>
            <ArrowLeftRight className="size-4" aria-hidden />
            {t("account.menu.switch")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => out.mutate("session")}>
            <LogOut className="size-4" aria-hidden />
            {t("account.menu.signOut")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => out.mutate("device")}>
            <MonitorX className="size-4" aria-hidden />
            <span>
              <span className="block">{t("account.menu.signOutDevice")}</span>
              <span className="block text-xs font-normal text-muted">
                {t("account.menu.signOutDeviceHint")}
              </span>
            </span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <SwitchDialog open={switching} onOpenChange={setSwitching} />
    </>
  )
}

function SwitchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useI18n()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const accounts = useQuery({ ...deviceAccountsQuery, enabled: open })
  const sw = useMutation({
    mutationFn: (id: string) => switchSession(id),
    onSuccess: async (res) => {
      invalidateCsrfToken()
      onOpenChange(false)
      await qc.invalidateQueries({ queryKey: ["account"] })
      toast(t("account.menu.switched", { name: res.account.display_name }))
      await navigate({ to: "/account" })
    },
  })
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={t("account.menu.switchTitle")} description={t("account.menu.switchLead")}>
        {accounts.isPending ? (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        ) : (
          <ul className="-mx-2 divide-y divide-line">
            {(accounts.data?.accounts ?? []).map((a) => (
              <li key={a.session_id}>
                {a.signed_out ? (
                  <Link
                    to="/signin"
                    onClick={() => onOpenChange(false)}
                    className="flex min-h-16 items-center gap-3 rounded-xl px-2 py-2 hover:bg-surface-muted"
                  >
                    <Avatar initials={a.account.avatar_initials} className="size-10 opacity-60 grayscale" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{a.account.display_name}</span>
                      <span className="block truncate text-sm text-muted">{a.account.email_masked}</span>
                    </span>
                    <span className="text-xs text-subtle">{t("auth.choose.signedOut")}</span>
                  </Link>
                ) : (
                  <button
                    type="button"
                    disabled={a.active || sw.isPending}
                    onClick={() => sw.mutate(a.session_id)}
                    className="flex min-h-16 w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-surface-muted disabled:hover:bg-transparent"
                  >
                    <Avatar initials={a.account.avatar_initials} className="size-10" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{a.account.display_name}</span>
                      <span className="block truncate text-sm text-muted">{a.account.email_masked}</span>
                    </span>
                    {a.active ? (
                      <span className="text-xs font-semibold text-eyebrow">{t("account.menu.current")}</span>
                    ) : null}
                    {sw.isPending && sw.variables === a.session_id ? <Spinner /> : null}
                  </button>
                )}
              </li>
            ))}
            <li>
              <Link
                to="/signin"
                onClick={() => onOpenChange(false)}
                className="flex min-h-16 items-center gap-3 rounded-xl px-2 py-2 font-semibold hover:bg-surface-muted"
              >
                <span className="inline-flex size-10 items-center justify-center rounded-full ring-1 ring-line-strong">
                  <Plus className="size-5" aria-hidden />
                </span>
                {t("account.menu.addAccount")}
              </Link>
            </li>
          </ul>
        )}
        {sw.error ? <FormError className="mt-4" error={sw.error} /> : null}
      </DialogContent>
    </Dialog>
  )
}
