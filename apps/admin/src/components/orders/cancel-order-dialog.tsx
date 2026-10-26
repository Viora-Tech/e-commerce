'use client'

import type { RefundOptions, RefundRoute } from '@commerce/core'
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

/** The best refund the order allows: back to the original payment, else recorded by hand. */
const defaultRoute = (options: RefundOptions): RefundRoute =>
  options.refundablePaise <= 0 ? 'none' : options.original ? 'original' : 'manual'

/**
 * "Cancel order" (Shopify's dialog): a reason, restock (off by default for an imported order),
 * notify the customer, and how the money goes back. Centred, buttons on the right.
 */
export default function CancelOrderDialog({ order, onClose, onDone }: CancelOrderDialogProps) {
  // Hooks
  const copy = useCopy(orderCancelContent)
  const [reason, setReason] = useState('')
  const [restock, setRestock] = useState(true)
  const [notify, setNotify] = useState(true)
  const [options, setOptions] = useState<RefundOptions | null>(null)
  const [route, setRoute] = useState<RefundRoute>('none')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!order) return
    let live = true
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

  return (
    <Dialog open={order !== null} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{copy.title}</DialogTitle>
            <DialogDescription>{copy.body}</DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="cancel-reason">{copy.reason}</FieldLabel>
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
