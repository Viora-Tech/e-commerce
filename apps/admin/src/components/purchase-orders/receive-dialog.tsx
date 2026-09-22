'use client'

import { remainingOf } from '@commerce/core/inventory'
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
import { variantLabel } from '@/components/inventory/variant-picker'
import KitThumb from '@/components/kit/kit-thumb'
import { purchaseOrderFormContent } from '@/data/inventory'
import { api } from '@/lib/api-client'
import { type LoadedPurchaseOrder, toCount } from './form-state'

type ReceiveDialogProps = {
  po: LoadedPurchaseOrder
  open: boolean
  onOpenChange: (open: boolean) => void
  onReceived: () => void
}

const copy = purchaseOrderFormContent.receiving

const outstandingLines = (po: LoadedPurchaseOrder) => po.lines.filter((l) => remainingOf(l) > 0)

/**
 * Partial receipt: one count per outstanding line. What arrives moves from
 * incoming to on hand at the destination, logged as `received`.
 */
export default function ReceiveDialog({ po, open, onOpenChange, onReceived }: ReceiveDialogProps) {
  // Hooks
  const [counts, setCounts] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleAll = () =>
    setCounts(Object.fromEntries(outstandingLines(po).map((l) => [l.id, String(remainingOf(l))])))

  const handleReceive = async () => {
    const receipts = outstandingLines(po)
      .map((l) => ({
        lineId: l.id,
        quantity: Math.min(toCount(counts[l.id] ?? ''), remainingOf(l)),
      }))
      .filter((r) => r.quantity > 0)
    if (receipts.length === 0) {
      toast.error(copy.nothing)
      return
    }
    setBusy(true)
    try {
      const units = await api.purchaseOrders.receive({ id: po.id, receipts })
      toast.success(copy.done(units))
      setCounts({})
      onOpenChange(false)
      onReceived()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const outstanding = outstandingLines(po)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.body}</DialogDescription>
        </DialogHeader>
        <ul className="flex max-h-[24rem] flex-col overflow-y-auto">
          {outstanding.map((l) => (
            <li
              key={l.id}
              className="flex items-center gap-3 border-line border-b py-2 last:border-b-0"
            >
              <KitThumb src={l.imageUrl} alt="" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-body">{variantLabel(l)}</span>
                <span className="text-caption text-muted-foreground">
                  {copy.outstanding(remainingOf(l))}
                </span>
              </span>
              <Input
                aria-label={variantLabel(l)}
                value={counts[l.id] ?? ''}
                inputMode="numeric"
                placeholder="0"
                className="w-20 text-right tabular-nums"
                onChange={(e) => setCounts({ ...counts, [l.id]: e.target.value })}
              />
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button variant="ghost" className="mr-auto" onClick={handleAll}>
            {copy.all}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {copy.cancel}
          </Button>
          <Button onClick={handleReceive} disabled={busy}>
            {copy.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
