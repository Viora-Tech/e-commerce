'use client'

import { parseRupees } from '@commerce/money'
import { RotateCcw } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Dialog, DialogDescription, DialogTitle } from '@commerce/ui/shadcn/dialog'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { RadioGroup, RadioGroupItem } from '@commerce/ui/shadcn/radio-group'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import { type FormEvent, useState } from 'react'
import { toast } from 'sonner'
import OptionSelect from '@/components/landed-cost/option-select'
import DialogContent from '@/components/layout/dialog-content'
import DialogFooter from '@/components/layout/dialog-footer'
import DialogHeader from '@/components/layout/dialog-header'
import { orderDetailContent } from '@/data/order-detail'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import type { OrderPayment } from './order-detail-types'

type RefundDialogProps = {
  payment: OrderPayment | null
  /** Paise still refundable on `payment`. */
  remainingPaise: number
  /** Imported from another platform: that platform took the money, so only by hand or store credit. */
  imported?: boolean
  onClose: () => void
  onDone: () => void
}

const OFFLINE = new Set(['cod', 'manual'])

/** Back through the gateway, recorded as sent another way, or onto the customer's store credit balance. */
type Way = 'original' | 'manual' | 'store_credit'

/** Ways to record money sent back by hand (store credit is its own choice). */
const HAND_METHODS = ['upi', 'bank_transfer', 'cash', 'cheque', 'other'] as const
type HandMethod = (typeof HAND_METHODS)[number]

const PROVIDER_NAMES: Record<string, string> = {
  razorpay: 'Razorpay',
  cashfree: 'Cashfree',
  decentro: 'Decentro',
}

export default function RefundDialog({
  payment,
  remainingPaise,
  imported = false,
  onClose,
  onDone,
}: RefundDialogProps) {
  // Hooks
  const copy = useCopy(orderDetailContent)
  const fmt = useFormat()
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [way, setWay] = useState<Way | null>(null)
  const [method, setMethod] = useState<HandMethod>('upi')
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
        manual: chosen === 'manual' || undefined,
        method:
          chosen === 'store_credit' ? 'store_credit' : chosen === 'manual' ? method : undefined,
      })
      toast.success(copy.refundDialog.done(fmt.money(paise)))
      setAmount('')
      setReason('')
      setWay(null)
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.refundDialog.failed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const paise = parseRupees(amount)
  const r = copy.refundDialog
  const valid = paise !== null && paise > 0 && paise <= remainingPaise
  const offline = payment ? OFFLINE.has(payment.provider) : false
  const giftCard = payment?.provider === 'gift_card'
  // Paid from store credit at checkout: it can only go back onto the same balance.
  const fromCredit = payment?.provider === 'store_credit'
  const via = payment ? (PROVIDER_NAMES[payment.provider] ?? payment.provider) : ''
  const ways: { id: Way; label: string; hint: string }[] =
    giftCard || fromCredit
      ? []
      : [
          ...(offline || imported
            ? []
            : [{ id: 'original' as const, label: r.original(via), hint: r.originalHint }]),
          { id: 'manual', label: r.manual, hint: r.manualHint },
          { id: 'store_credit', label: r.storeCredit, hint: r.storeCreditHint },
        ]
  const chosen: Way | null =
    giftCard || fromCredit ? null : (way ?? (offline || imported ? 'manual' : 'original'))
  const methodLabels = Object.fromEntries(HAND_METHODS.map((m) => [m, r.methods[m]])) as Record<
    HandMethod,
    string
  >

  return (
    <Dialog open={payment !== null} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{copy.refundDialog.title}</DialogTitle>
            <DialogDescription>
              {copy.refundDialog.body(fmt.money(remainingPaise))}
              {fromCredit
                ? ` ${r.storeCreditBack}`
                : imported
                  ? ` ${r.importedNote}`
                  : offline
                    ? ` ${copy.refundDialog.manualNote}`
                    : ''}
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
          {ways.length > 0 ? (
            <FieldSet>
              <FieldLegend variant="label">{r.how}</FieldLegend>
              <RadioGroup value={chosen ?? ''} onValueChange={(v) => setWay(v as Way)}>
                {ways.map((w) => (
                  <Field key={w.id} orientation="horizontal">
                    <RadioGroupItem id={`refund-way-${w.id}`} value={w.id} />
                    <FieldContent>
                      <FieldLabel htmlFor={`refund-way-${w.id}`}>{w.label}</FieldLabel>
                      <FieldDescription>{w.hint}</FieldDescription>
                    </FieldContent>
                  </Field>
                ))}
              </RadioGroup>
            </FieldSet>
          ) : null}
          {chosen === 'manual' ? (
            <Field>
              <FieldLabel htmlFor="refund-method">{r.method}</FieldLabel>
              <OptionSelect
                id="refund-method"
                options={HAND_METHODS}
                labels={methodLabels}
                value={method}
                onChange={setMethod}
              />
            </Field>
          ) : null}
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
              <RotateCcw aria-hidden="true" />
              {copy.refundDialog.confirm}
              {valid ? ` ${fmt.money(paise)}` : ''}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
