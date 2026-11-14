'use client'

import ConfirmDialog from '@/components/layout/confirm-dialog'
import { dataRequestDetailContent as copy } from '@/data/customer-privacy'

type EraseCustomerDialogProps = {
  open: boolean
  busy: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

/** Confirms erasing a customer's personal data; says plainly what is kept and that it is final. */
export default function EraseCustomerDialog({
  open,
  busy,
  onOpenChange,
  onConfirm,
}: EraseCustomerDialogProps) {
  // Render logic
  return (
    <ConfirmDialog
      tone="destructive"
      open={open}
      onOpenChange={onOpenChange}
      title={copy.eraseTitle}
      body={copy.eraseBody}
      confirmLabel={copy.eraseConfirm}
      cancelLabel={copy.cancel}
      busy={busy}
      onConfirm={onConfirm}
    />
  )
}
