'use client'

import type { OrderEditInput, OrderEditPreview, RefundRoute } from '@commerce/core'
import { CircleCheck } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@commerce/ui/shadcn/dialog'
import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import { Label } from '@commerce/ui/shadcn/label'
import { Switch } from '@commerce/ui/shadcn/switch'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { orderEditContent } from '@/data/order-edit'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import RefundRouteField from '../refund-route-field'
import EditShippedAlert from './edit-shipped-alert'
import { lineName } from './edit-state'

type EditReviewDialogProps = {
  /** The edit to review; null keeps the dialog closed. */
  input: OrderEditInput | null
  /** The order has shipped: the warning repeats above Save. */
  shipped: boolean
  onClose: () => void
  onSaved: () => void
}

/** One line per change, in the order the editor shows them: items, then shipping, discount and their labels. */
function changeList(
  p: OrderEditPreview,
  words: (typeof orderEditContent)['changes'],
  money: (paise: number) => string,
): string[] {
  const items = p.lines.flatMap((l) => {
    const name = lineName(l.title, l.variantTitle)
    const kept = (line: string) => (l.restock === false ? words.notRestocked(line) : line)
    if (l.change === 'added') return [words.added(l.quantity, name)]
    if (l.change === 'removed') return [kept(words.removed(name))]
    if (l.change !== 'changed') return []
    return [
      ...(l.quantity !== l.quantityBefore
        ? [kept(words.changed(name, l.quantityBefore, l.quantity))]
        : []),
      ...(l.unitPricePaise !== l.unitPriceBefore
        ? [words.price(name, money(l.unitPriceBefore), money(l.unitPricePaise))]
        : []),
    ]
  })
  const { before, after, labels } = p
  return [
    ...items,
    ...(after.shippingPaise !== before.shippingPaise
      ? [words.shipping(money(before.shippingPaise), money(after.shippingPaise))]
      : []),
    ...(after.discountPaise !== before.discountPaise
      ? [words.discount(money(before.discountPaise), money(after.discountPaise))]
      : []),
    ...(labels.after.shippingLabel !== labels.before.shippingLabel
      ? [words.shippingLabel(labels.after.shippingLabel ?? '')]
      : []),
    ...(labels.after.discountLabel !== labels.before.discountLabel
      ? [words.discountLabel(labels.after.discountLabel ?? '')]
      : []),
  ]
}

/**
 * The edit's review step (centred dialog): what changes, the new total against what was paid,
 * and how the difference is settled (a payment link, or a refund), then Save.
 */
export default function EditReviewDialog({
  input,
  shipped,
  onClose,
  onSaved,
}: EditReviewDialogProps) {
  // Hooks
  const copy = useCopy(orderEditContent)
  const fmt = useFormat()
  const [preview, setPreview] = useState<OrderEditPreview | null>(null)
  const [error, setError] = useState<string | null>(null)
  // The edit offers no store credit yet (the field leaves it out; the API refuses it).
  const [route, setRoute] = useState<Exclude<RefundRoute, 'store_credit'>>('none')
  const [requestPayment, setRequestPayment] = useState(true)
  const [notifyCustomer, setNotifyCustomer] = useState(true)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!input) return
    let live = true
    setPreview(null)
    setError(null)
    setNote('')
    setNotifyCustomer(true)
    api.orders
      .editPreview(input)
      .then((p) => {
        if (!live) return
        setPreview(p)
        setRoute(p.refund.original ? 'original' : 'manual')
        setRequestPayment(p.canEmail)
      })
      .catch((err) => live && setError(err instanceof Error ? err.message : copy.failed))
    return () => {
      live = false
    }
  }, [input, copy.failed])

  // Event handlers
  const handleSave = async () => {
    if (!input || !preview) return
    setBusy(true)
    try {
      await api.orders.edit({
        ...input,
        refund: owedBack > 0 ? route : 'none',
        requestPayment: owes > 0 && requestPayment,
        note: note.trim() || undefined,
        notifyCustomer,
      })
      toast.success(copy.saved)
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const settles = preview?.paidAtCheckout ?? false
  const diff = preview?.differencePaise ?? 0
  const owes = settles && diff > 0 ? diff : 0
  const owedBack = settles && diff < 0 ? Math.min(-diff, preview?.refund.refundablePaise ?? 0) : 0
  const changes = preview ? changeList(preview, copy.changes, fmt.money) : []

  return (
    <Dialog open={input !== null} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{copy.reviewTitle}</DialogTitle>
          <DialogDescription>
            {preview
              ? copy.reviewBody(
                  fmt.money(preview.before.totalPaise),
                  fmt.money(preview.after.totalPaise),
                )
              : (error ?? copy.loading)}
          </DialogDescription>
        </DialogHeader>
        {preview ? (
          <div className="flex flex-col gap-5">
            {shipped ? <EditShippedAlert /> : null}
            <ul className="flex list-disc flex-col gap-1 pl-5 text-body">
              {changes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <p className="rounded-md bg-muted px-3 py-2.5 text-body text-ink-strong">
              {!settles
                ? copy.unpaid
                : owes > 0
                  ? copy.customerOwes(fmt.money(owes))
                  : diff < 0
                    ? copy.storeOwes(fmt.money(-diff))
                    : copy.noDifference}
            </p>
            {owes > 0 ? (
              preview.canEmail ? (
                <Field>
                  <Label htmlFor="edit-request" className="flex items-center gap-2 font-normal">
                    <Switch
                      id="edit-request"
                      checked={requestPayment}
                      onCheckedChange={setRequestPayment}
                    />
                    {copy.requestPayment}
                  </Label>
                  <FieldDescription>{copy.requestPaymentHint}</FieldDescription>
                </Field>
              ) : (
                <p className="text-body text-muted-foreground">{copy.noEmail}</p>
              )
            ) : null}
            {owedBack > 0 ? (
              <RefundRouteField
                options={preview.refund}
                amountPaise={owedBack}
                value={route}
                onChange={(r) => setRoute(r === 'store_credit' ? 'none' : r)}
                idPrefix="edit-refund"
              />
            ) : null}
            <Field>
              <Label htmlFor="edit-notify" className="flex items-center gap-2 font-normal">
                <Switch
                  id="edit-notify"
                  checked={notifyCustomer}
                  onCheckedChange={setNotifyCustomer}
                />
                {copy.notifyCustomer}
              </Label>
              <FieldDescription>{copy.notifyCustomerHint}</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="edit-note">{copy.note}</FieldLabel>
              <Textarea
                id="edit-note"
                rows={2}
                maxLength={500}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={copy.notePlaceholder}
              />
            </Field>
          </div>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            {copy.keepEditing}
          </Button>
          <Button type="button" onClick={handleSave} disabled={busy || !preview}>
            <CircleCheck aria-hidden="true" />
            {copy.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
