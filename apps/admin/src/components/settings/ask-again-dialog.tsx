'use client'

import ConfirmDialog from '@/components/layout/confirm-dialog'
import { customerPrivacyContent, dataRequestDetailContent } from '@/data/customer-privacy'
import { useCopy } from '@/hooks/use-copy'

type AskAgainDialogProps = {
  open: boolean
  busy: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

/** Confirms showing the cookie banner to every shopper again. */
export default function AskAgainDialog({
  open,
  busy,
  onOpenChange,
  onConfirm,
}: AskAgainDialogProps) {
  // Hooks
  const copy = useCopy(customerPrivacyContent.banner)
  const dataRequestDetailCopy = useCopy(dataRequestDetailContent)

  // Render logic
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={copy.askAgainConfirmTitle}
      body={copy.askAgainConfirmBody}
      confirmLabel={copy.askAgainConfirm}
      cancelLabel={dataRequestDetailCopy.cancel}
      tone="default"
      busy={busy}
      onConfirm={onConfirm}
    />
  )
}
