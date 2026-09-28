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
import { Input } from '@commerce/ui/shadcn/input'
import { useState } from 'react'
import { toast } from 'sonner'
import ProductThumb from '@/components/products/product-thumb'
import { orderDetailContent } from '@/data/orders'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { type OrderDetail, unfulfilledLines } from './order-detail-types'
import TrackingFields, {
  EMPTY_TRACKING,
  type TrackingDraft,
  trackingPayload,
} from './tracking-fields'

type FulfilDialogProps = {
  order: OrderDetail | null
  onClose: () => void
  onDone: () => void
}

/** Choose what goes out now, with an optional courier and tracking number. */
export default function FulfilDialog({ order, onClose, onDone }: FulfilDialogProps) {
  // Hooks
  const copy = useCopy(orderDetailContent)
  const [picks, setPicks] = useState<Record<string, number>>({})
  const [tracking, setTracking] = useState<TrackingDraft>(EMPTY_TRACKING)
  const [busy, setBusy] = useState(false)

  // Helpers
  const quantityFor = (lineId: string, remaining: number) => picks[lineId] ?? remaining

  // Event handlers
  const handleQuantity = (lineId: string, value: string, remaining: number) => {
    const n = Number.parseInt(value, 10)
    const safe = Number.isFinite(n) ? Math.min(Math.max(n, 0), remaining) : 0
    setPicks((p) => ({ ...p, [lineId]: safe }))
  }

  const handleClose = () => {
    setPicks({})
    setTracking(EMPTY_TRACKING)
    onClose()
  }

  const handleConfirm = async () => {
    if (!order) return
    const lines = rows
      .map(({ line, remaining }) => ({
        lineId: line.id,
        quantity: quantityFor(line.id, remaining),
      }))
      .filter((l) => l.quantity > 0)
    if (lines.length === 0) return
    setBusy(true)
    try {
      await api.orders.fulfil({
        orderId: order.id,
        lines,
        ...trackingPayload(tracking),
      })
      toast.success(copy.fulfilDialog.done)
      setPicks({})
      setTracking(EMPTY_TRACKING)
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.fulfilDialog.failed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const rows = order ? unfulfilledLines(order) : []
  const total = rows.reduce((sum, r) => sum + quantityFor(r.line.id, r.remaining), 0)

  return (
    <Dialog open={order !== null} onOpenChange={(open) => (!open ? handleClose() : undefined)}>
      <DialogContent className="sm:max-w-lg">
        <div className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{copy.fulfilDialog.title}</DialogTitle>
            <DialogDescription>{copy.fulfilDialog.body}</DialogDescription>
          </DialogHeader>

          {rows.length === 0 ? (
            <p className="text-body text-muted-foreground">{copy.fulfilDialog.nothing}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {rows.map(({ line, remaining }) => (
                <li key={line.id} className="flex items-center gap-3 py-3 first:pt-0">
                  <ProductThumb url={line.imageUrl} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{line.title}</p>
                    <p className="text-caption font-normal">
                      {copy.unfulfilled.ofQuantity(line.fulfilledQuantity, line.quantity)}
                    </p>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    max={remaining}
                    aria-label={copy.fulfilDialog.quantity}
                    className="w-20 tabular-nums"
                    value={quantityFor(line.id, remaining)}
                    onChange={(e) => handleQuantity(line.id, e.target.value, remaining)}
                  />
                </li>
              ))}
            </ul>
          )}

          <TrackingFields value={tracking} onChange={setTracking} />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={busy}>
              {copy.fulfilDialog.cancel}
            </Button>
            <Button type="button" onClick={handleConfirm} disabled={busy || total === 0}>
              {copy.fulfilDialog.confirm}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
