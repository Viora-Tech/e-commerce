'use client'

import { parseRupees } from '@commerce/money'
import { Button } from '@commerce/ui/shadcn/button'
import { Dialog, DialogDescription, DialogTitle } from '@commerce/ui/shadcn/dialog'
import { Field, FieldDescription, FieldError, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { type FormEvent, useState } from 'react'
import { toast } from 'sonner'
import DialogContent from '@/components/layout/dialog-content'
import DialogFooter from '@/components/layout/dialog-footer'
import DialogHeader from '@/components/layout/dialog-header'
import { customerStoreCreditContent } from '@/data/customer-store-credit'
import { useCopy, useLocale } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { formatPaise } from '@/lib/money'

type StoreCreditDialogProps = {
  customerId: string
  /** Add or remove; null keeps the dialog closed. */
  mode: 'add' | 'remove' | null
  balancePaise: number
  onClose: () => void
  onDone: () => void
}

/** Add or remove store credit: an amount and the reason the history shows. */
export default function StoreCreditDialog({
  customerId,
  mode,
  balancePaise,
  onClose,
  onDone,
}: StoreCreditDialogProps) {
  // Hooks
  const copy = useCopy(customerStoreCreditContent)
  const locale = useLocale()
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  // Helpers
  const reset = () => {
    setAmount('')
    setReason('')
  }

  // Event handlers
  const handleClose = () => {
    reset()
    onClose()
  }
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!valid || paise === null) return
    setBusy(true)
    try {
      await api.storeCredit.adjust({
        customerId,
        amountPaise: mode === 'remove' ? -paise : paise,
        reason: reason.trim(),
      })
      toast.success(mode === 'remove' ? d.removed : d.added)
      reset()
      onDone()
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : d.failed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const d = copy.dialog
  const paise = amount.trim() === '' ? null : parseRupees(amount)
  const tooMuch = mode === 'remove' && paise !== null && paise > balancePaise
  const valid = paise !== null && paise > 0 && !tooMuch && reason.trim().length > 0

  return (
    <Dialog open={mode !== null} onOpenChange={(open) => (!open ? handleClose() : undefined)}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{mode === 'remove' ? d.removeTitle : d.addTitle}</DialogTitle>
            <DialogDescription>{d.body(formatPaise(balancePaise, locale))}</DialogDescription>
          </DialogHeader>
          <Field data-invalid={tooMuch || undefined}>
            <FieldLabel htmlFor="store-credit-amount">{d.amount}</FieldLabel>
            <Input
              id="store-credit-amount"
              type="number"
              inputMode="decimal"
              min="1"
              step="0.01"
              value={amount}
              aria-invalid={tooMuch || undefined}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
            />
            {tooMuch ? <FieldError>{d.tooMuch}</FieldError> : null}
          </Field>
          <Field>
            <FieldLabel htmlFor="store-credit-reason">{d.reason}</FieldLabel>
            <Input
              id="store-credit-reason"
              value={reason}
              maxLength={200}
              placeholder={d.reasonPlaceholder}
              onChange={(e) => setReason(e.target.value)}
            />
            <FieldDescription>{d.reasonHint}</FieldDescription>
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={busy}>
              {d.cancel}
            </Button>
            <Button
              type="submit"
              variant={mode === 'remove' ? 'destructive' : 'default'}
              disabled={!valid}
              loading={busy}
            >
              {mode === 'remove' ? d.saveRemove : d.saveAdd}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
