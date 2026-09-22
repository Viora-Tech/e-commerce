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
import Link from 'next/link'
import { type FormEvent, useState } from 'react'
import { toast } from 'sonner'
import { orderDetailContent as copy } from '@/data/orders'
import { api } from '@/lib/api-client'
import { formatPaise } from '@/lib/money'
import type { OrderDetail } from './order-detail-types'

type CollectPaymentDialogProps = {
  order: OrderDetail | null
  /** What the shopper still owes, in paise. */
  balancePaise: number
  /** True when the money should come through the gateway rather than be recorded here. */
  gateway: boolean
  payHref: string
  onClose: () => void
  onDone: () => void
}

/** Rupees typed by the merchant → paise; NaN for junk. */
function toPaise(rupees: string): number {
  return Math.round(Number.parseFloat(rupees) * 100)
}

/** Record cash or a bank transfer the merchant took outside the gateway. */
export default function CollectPaymentDialog({
  order,
  balancePaise,
  gateway,
  payHref,
  onClose,
  onDone,
}: CollectPaymentDialogProps) {
  // Hooks
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!order || !valid) return
    setBusy(true)
    try {
      await api.orders.collectPayment({ orderId: order.id, amountPaise: paise })
      toast.success(copy.collectDialog.done)
      setAmount('')
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.collectDialog.failed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const paise = amount.trim() === '' ? balancePaise : toPaise(amount)
  const valid = Number.isInteger(paise) && paise > 0

  return (
    <Dialog open={order !== null} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{copy.collectDialog.title}</DialogTitle>
            <DialogDescription>
              {copy.collectDialog.body(formatPaise(balancePaise))}
              {gateway ? ` ${copy.collectDialog.gatewayNote}` : ''}
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="collect-amount">{copy.collectDialog.amount}</FieldLabel>
            <Input
              id="collect-amount"
              type="number"
              inputMode="decimal"
              min="1"
              step="1"
              placeholder={String(balancePaise / 100)}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
            />
          </Field>
          <DialogFooter>
            {gateway ? (
              <Button type="button" variant="outline" render={<Link href={payHref} />}>
                {copy.collectDialog.openPayPage}
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              {copy.collectDialog.cancel}
            </Button>
            <Button type="submit" disabled={!valid || busy}>
              {copy.collectDialog.confirm}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
