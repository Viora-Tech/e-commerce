'use client'

import type { OrderCancelReason, RefundOptions, RefundRoute } from '@commerce/core'
import { CancelCircle } from '@commerce/ui/icons'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import { Switch } from '@commerce/ui/shadcn/switch'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import { type FormEvent, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { orderCancelContent } from '@/data/order-edit'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import type { OrderDetail } from './order-detail-types'
import RefundRouteField from './refund-route-field'

type CancelOrderDialogProps = {
  /** The order to cancel; null keeps the dialog closed. */
  order: OrderDetail | null
  onClose: () => void
  onDone: () => void
}

/** Came from another platform (still imported, or taken over): its stock was counted there. */
const wasImported = (o: OrderDetail) => Boolean(o.importedFrom || o.importMeta?.takenOver)

/** Paid outside any gateway (cash on delivery, recorded payments): nothing to send money back through. */
const OFFLINE_PROVIDERS = new Set(['cod', 'manual'])

/**
 * The best refund the order allows: back to the original payment, else recorded by hand. Cash on
 * delivery has no gateway to refund into, so it starts on "recorded by hand", which is what the
 * merchant actually does.
 */
const defaultRoute = (options: RefundOptions): RefundRoute => {
  if (options.refundablePaise <= 0) return 'none'
  const offlineOnly = options.providers.every((p) => OFFLINE_PROVIDERS.has(p))
  return options.original && !offlineOnly ? 'original' : 'manual'
}

/**
 * "Cancel order" (Shopify's dialog): a reason from the list and a note, restock (off by default for an imported order),
 * notify the customer, and how the money goes back. Centred, buttons on the right.
 */
export default function CancelOrderDialog({ order, onClose, onDone }: CancelOrderDialogProps) {
  // Hooks
  const copy = useCopy(orderCancelContent)
  const [reasonCode, setReasonCode] = useState<OrderCancelReason>('customer')
  const [reason, setReason] = useState('')
  const [restock, setRestock] = useState(true)
  const [notify, setNotify] = useState(true)
  const [options, setOptions] = useState<RefundOptions | null>(null)
  const [route, setRoute] = useState<RefundRoute>('none')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!order) return
    let live = true
    setReasonCode('customer')
    setReason('')
    setRestock(!wasImported(order))
    setNotify(Boolean(order.email))
    setOptions(null)
    api.orders.refundOptions({ orderId: order.id }).then((o) => {
      if (!live) return
      setOptions(o)
      setRoute(defaultRoute(o))
    })
    return () => {
      live = false
    }
  }, [order])

  // Event handlers
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!order || !options) return
    setBusy(true)
    try {
      await api.orders.cancel({
        orderId: order.id,
        reasonCode,
        reason: reason.trim() || undefined,
        restock,
        notifyCustomer: notify,
        refund: options.refundablePaise > 0 ? route : 'none',
      })
      toast.success(copy.done)
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const imported = order ? wasImported(order) : false
  const reasonItems = Object.entries(copy.reasons).map(([value, label]) => ({ value, label }))

  return (
    <Dialog open={order !== null} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{copy.title}</DialogTitle>
            <DialogDescription>{copy.body}</DialogDescription>
          </DialogHeader>
          {/* A short list, Shopify-like (#125), with an optional note under it. */}
          <Field>
            <FieldLabel htmlFor="cancel-reason-code">{copy.reason}</FieldLabel>
            <Select
              items={reasonItems}
              value={reasonCode}
              onValueChange={(v) => v && setReasonCode(v as OrderCancelReason)}
            >
              <SelectTrigger id="cancel-reason-code" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {reasonItems.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="cancel-reason">{copy.note}</FieldLabel>
            <Textarea
              id="cancel-reason"
              rows={2}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={copy.reasonPlaceholder}
            />
          </Field>
          <Field>
            <Label htmlFor="cancel-restock" className="flex items-center gap-2 font-normal">
              <Switch id="cancel-restock" checked={restock} onCheckedChange={setRestock} />
              {copy.restock}
            </Label>
            <FieldDescription>
              {imported ? copy.restockImported : copy.restockHint}
            </FieldDescription>
          </Field>
          <Field>
            <Label htmlFor="cancel-notify" className="flex items-center gap-2 font-normal">
              <Switch id="cancel-notify" checked={notify} onCheckedChange={setNotify} />
              {copy.notify}
            </Label>
            <FieldDescription>{copy.notifyHint}</FieldDescription>
          </Field>
          {options && options.refundablePaise > 0 ? (
            <RefundRouteField
              options={options}
              amountPaise={options.refundablePaise}
              value={route}
              onChange={setRoute}
              idPrefix="cancel-refund"
              storeCredit
            />
          ) : options ? (
            <p className="text-body text-muted-foreground">{copy.nothingToRefund}</p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              {copy.keep}
            </Button>
            <Button type="submit" variant="destructive" disabled={busy || !options}>
              <CancelCircle aria-hidden="true" />
              {copy.confirm}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
