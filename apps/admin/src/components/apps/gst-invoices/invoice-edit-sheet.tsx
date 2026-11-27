'use client'

import type { DocumentSnapshot, InvoiceEdit } from '@commerce/invoices'
import { X } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@commerce/ui/shadcn/sheet'
import { useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import { gstInvoiceEditContent } from '@/data/gst-invoice-edit'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { errorText } from '@/lib/api-errors'
import { formatPaise } from '@/lib/money'
import InvoiceEditBuyer from './invoice-edit-buyer'
import { type EditForm, editOf, formOf, totalOf } from './invoice-edit-form'
import InvoiceEditLines from './invoice-edit-lines'
import TextField from './text-field'

type InvoiceEditSheetProps = {
  invoiceId: string
  orderId: string
  number: string
  snapshot: DocumentSnapshot
  start: InvoiceEdit
  onClose: () => void
  onSaved: () => void
}

/**
 * "Edit invoice" in a wide side sheet, like the loyalty rule sheet: the items with quantity,
 * unit price and discount, the charges, the buyer and an optional reason. Save rebuilds the
 * invoice on the server under the same number, then offers to email it to the buyer.
 */
export default function InvoiceEditSheet({
  invoiceId,
  orderId,
  number,
  snapshot,
  start,
  onClose,
  onSaved,
}: InvoiceEditSheetProps) {
  // Hooks
  const copy = useCopy(gstInvoiceEditContent.sheet)
  const [initial] = useState(() => formOf(start))
  const [form, setForm] = useState<EditForm>(initial)
  const [busy, setBusy] = useState(false)
  const [leaving, setLeaving] = useState(false)

  // Helpers
  const set = (patch: Partial<EditForm>) => setForm((f) => ({ ...f, ...patch }))
  const isDirty = () => JSON.stringify(form) !== JSON.stringify(initial)

  const emailBuyer = async () => {
    try {
      await api.gstInvoices.emailInvoice({ orderId })
      toast.success(copy.emailed)
    } catch (err) {
      toast.error(errorText(err, copy.emailFailed))
    }
  }

  // Event handlers
  const handleSave = async () => {
    const edit = editOf(form)
    if (!edit) {
      toast.error(copy.invalid)
      return
    }
    setBusy(true)
    try {
      await api.gstInvoices.saveEdit({ id: invoiceId, edit, reason: form.reason.trim() || null })
      toast.success(copy.saved, {
        duration: 15_000,
        action: { label: copy.email, onClick: () => void emailBuyer() },
      })
      onSaved()
    } catch (err) {
      toast.error(errorText(err, copy.failed))
    } finally {
      setBusy(false)
    }
  }

  const handleClose = () => {
    if (isDirty()) setLeaving(true)
    else onClose()
  }

  // Render logic
  const edit = editOf(form)
  const dirty = isDirty()
  const newTotal = edit ? totalOf(edit) : null

  return (
    <>
      <Sheet open onOpenChange={(open) => (!open ? handleClose() : undefined)}>
        <SheetContent
          side="right"
          showCloseButton={false}
          className="gap-0 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-4xl"
        >
          <div className="sticky top-0 z-10 flex flex-wrap items-start justify-between gap-3 border-b border-line bg-popover px-6 py-4">
            <div className="flex min-w-0 flex-col gap-1">
              <SheetTitle className="text-page-title text-ink-strong">
                {copy.title(number)}
              </SheetTitle>
              <SheetDescription className="text-body text-muted-foreground">
                {copy.description}
              </SheetDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleClose}>
                {copy.cancel}
              </Button>
              <Button onClick={handleSave} loading={busy} disabled={!dirty || !edit || busy}>
                {copy.save}
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label={copy.close} onClick={handleClose}>
                <X />
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-6 p-6">
            <InvoiceEditLines snapshot={snapshot} form={form} onChange={set} />
            <InvoiceEditBuyer
              form={form}
              exported={snapshot.exportSupply !== null}
              onChange={set}
            />
            <TextField
              id="edit-reason"
              label={copy.reason}
              value={form.reason}
              maxLength={200}
              onChange={(reason) => set({ reason })}
            />
            <div className="flex items-baseline justify-end gap-2 border-t border-line pt-4">
              <span className="text-body text-muted-foreground">{copy.total}</span>
              <span className="text-body font-medium tabular-nums">
                {newTotal === null ? '-' : formatPaise(newTotal)}
              </span>
              <span className="text-caption text-muted-foreground">
                {copy.was(formatPaise(snapshot.totals.totalPaise))}
              </span>
            </div>
          </div>
        </SheetContent>
      </Sheet>
      <ConfirmDialog
        open={leaving}
        onOpenChange={setLeaving}
        title={copy.discardTitle}
        body={copy.discardBody}
        confirmLabel={copy.discard}
        tone="destructive"
        onConfirm={onClose}
      />
    </>
  )
}
