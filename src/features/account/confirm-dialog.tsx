import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogFooter } from "@/components/ui/dialog"
import { useI18n } from "@/i18n"

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  body,
  confirmLabel,
  onConfirm,
  loading,
  destructive,
  children,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  title: string
  body?: ReactNode
  confirmLabel: string
  onConfirm: () => void
  loading?: boolean
  destructive?: boolean
  children?: ReactNode
}) {
  const { t } = useI18n()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={title} description={body}>
        {children}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary" size="md">
              {t("common.cancel")}
            </Button>
          </DialogClose>
          <Button
            variant={destructive ? "destructive" : "primary"}
            size="md"
            loading={loading}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
