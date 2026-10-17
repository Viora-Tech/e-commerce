'use client'

import ConfirmDialog from '@/components/layout/confirm-dialog'
import { customerPrivacyContent, dataRequestDetailContent } from '@/data/customer-privacy'

type AskAgainDialogProps = {
  open: boolean
  busy: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

const copy = customerPrivacyContent.banner

/** Confirms showing the cookie banner to every shopper again. */
export default function AskAgainDialog({
  open,
  busy,
  onOpenChange,
  onConfirm,
}: AskAgainDialogProps) {
  // Render logic
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={copy.askAgainConfirmTitle}
      body={copy.askAgainConfirmBody}
      confirmLabel={copy.askAgainConfirm}
      cancelLabel={dataRequestDetailContent.cancel}
      tone="default"
      busy={busy}
      onConfirm={onConfirm}
    />
  )
}
