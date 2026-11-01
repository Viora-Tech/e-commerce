'use client'

import { MANUAL_PAYMENT_METHODS, type ManualPaymentMethod } from '@commerce/core/manual-payments'
import { parseRupees } from '@commerce/money'
import { CircleCheck, ExternalLink } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Dialog, DialogDescription, DialogTitle } from '@commerce/ui/shadcn/dialog'
import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { RadioGroup, RadioGroupItem } from '@commerce/ui/shadcn/radio-group'
import Link from 'next/link'
import { type FormEvent, useState } from 'react'
import { toast } from 'sonner'
import DateField from '@/components/fields/date-field'
import DialogContent from '@/components/layout/dialog-content'
import DialogFooter from '@/components/layout/dialog-footer'
import DialogHeader from '@/components/layout/dialog-header'
import { orderDetailContent } from '@/data/order-detail'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { todayKey } from '@/lib/format-date'
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

/** Cash for cash on delivery, UPI for everything else: the most likely answer first. */
function likelyMethod(order: OrderDetail | null): ManualPaymentMethod {
  return order?.paymentMethod === 'cod' ? 'cash' : 'upi'
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
  const copy = useCopy(orderDetailContent)
  const fmt = useFormat()
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<ManualPaymentMethod | null>(null)
  const [reference, setReference] = useState('')
  const [receivedOn, setReceivedOn] = useState('')
  const [busy, setBusy] = useState(false)

  // Helpers
  const reset = () => {
    setAmount('')
    setMethod(null)
    setReference('')
    setReceivedOn('')
  }

  // Event handlers
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!order || !valid) return
    setBusy(true)
    try {
      await api.orders.collectPayment({
        orderId: order.id,
        amountPaise: paise,
        paidWith,
        ...(reference.trim() ? { reference: reference.trim() } : {}),
        receivedOn: day,
      })
      toast.success(copy.collectDialog.done)
      reset()
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.collectDialog.failed)
    } finally {
      setBusy(false)
    }
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  // Render logic
  const paise = amount.trim() === '' ? balancePaise : parseRupees(amount)
  const paidWith = method ?? likelyMethod(order)
  const day = receivedOn || todayKey()
  const valid = paise !== null && paise > 0 && day <= todayKey()
  const c = copy.collectDialog

  return (
    <Dialog open={order !== null} onOpenChange={(open) => (!open ? handleClose() : undefined)}>
      {/* A proper width for the amount, method and date row; the default felt cramped (#126). */}
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{copy.collectDialog.title}</DialogTitle>
            <DialogDescription>
              {copy.collectDialog.body(fmt.money(balancePaise))}
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
          <Field>
            <FieldLabel>{c.how}</FieldLabel>
            <RadioGroup
              value={paidWith}
              onValueChange={(v) => setMethod(v as ManualPaymentMethod)}
              className="grid gap-2 sm:grid-cols-2"
            >
              {MANUAL_PAYMENT_METHODS.map((m) => (
                <label
                  key={m}
                  htmlFor={`collect-method-${m}`}
                  className="flex min-h-11 items-center gap-2 rounded-md border border-border px-3 text-body has-data-checked:border-primary"
                >
                  <RadioGroupItem id={`collect-method-${m}`} value={m} />
                  {c.methods[m]}
                </label>
              ))}
            </RadioGroup>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="collect-reference">{c.reference}</FieldLabel>
              <Input
                id="collect-reference"
                value={reference}
                maxLength={80}
                placeholder={c.referencePlaceholder[paidWith]}
                onChange={(e) => setReference(e.target.value)}
              />
              <FieldDescription>{c.referenceHint}</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="collect-received">{c.receivedOn}</FieldLabel>
              <DateField
                id="collect-received"
                max={todayKey()}
                value={day}
                onChange={(v) => setReceivedOn(v)}
              />
            </Field>
          </div>
          <DialogFooter>
            {gateway ? (
              <Button
                nativeButton={false}
                type="button"
                variant="outline"
                render={<Link href={payHref} />}
              >
                <ExternalLink aria-hidden="true" />
                {copy.collectDialog.openPayPage}
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={handleClose} disabled={busy}>
              {copy.collectDialog.cancel}
            </Button>
            <Button type="submit" disabled={!valid || busy}>
              <CircleCheck aria-hidden="true" />
              {copy.collectDialog.confirm}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
