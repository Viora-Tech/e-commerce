'use client'

import { Button } from '@commerce/ui/shadcn/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@commerce/ui/shadcn/dialog'
import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import { type FormEvent, useState } from 'react'
import { toast } from 'sonner'
import { orderDetailContent as copy } from '@/data/orders'
import { api } from '@/lib/api-client'
import { formatPaise } from '@/lib/money'
import type { OrderPayment } from './order-detail-types'

type RefundDialogProps = {
  payment: OrderPayment | null
  /** Paise still refundable on `payment`. */
  remainingPaise: number
  onClose: () => void
  onDone: () => void
}

const OFFLINE = new Set(['cod', 'manual'])

/** Rupees typed by the merchant → paise; NaN for junk. */
function toPaise(rupees: string): number {
  return Math.round(Number.parseFloat(rupees) * 100)
}

export default function RefundDialog({
  payment,
  remainingPaise,
  onClose,
  onDone,
}: RefundDialogProps) {
  // Hooks
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!payment || !valid) return
    setBusy(true)
    try {
      await api.orders.refund({
        paymentId: payment.id,
        amountPaise: paise,
        reason: reason.trim() || undefined,
      })
      toast.success(copy.refundDialog.done(formatPaise(paise)))
      setAmount('')
      setReason('')
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.refundDialog.failed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const paise = toPaise(amount)
  const valid = Number.isInteger(paise) && paise > 0 && paise <= remainingPaise
  const offline = payment ? OFFLINE.has(payment.provider) : false

  return (
    <Dialog open={payment !== null} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{copy.refundDialog.title}</DialogTitle>
            <DialogDescription>
              {copy.refundDialog.body(formatPaise(remainingPaise))}
              {offline ? ` ${copy.refundDialog.manualNote}` : ''}
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="refund-amount">{copy.refundDialog.amount}</FieldLabel>
            <div className="flex gap-2">
              <Input
                id="refund-amount"
                type="number"
                inputMode="decimal"
                min="1"
                step="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                autoFocus
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setAmount(String(remainingPaise / 100))}
              >
                {copy.refundDialog.full}
              </Button>
            </div>
          </Field>
          <Field>
            <FieldLabel htmlFor="refund-reason">{copy.refundDialog.reason}</FieldLabel>
            <Textarea
              id="refund-reason"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={copy.refundDialog.reasonPlaceholder}
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              {copy.refundDialog.close}
            </Button>
            <Button type="submit" disabled={!valid || busy}>
              {copy.refundDialog.confirm}
              {valid ? ` ${formatPaise(paise)}` : ''}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
