'use client'

import { remainingOf, weightedAverageCost } from '@commerce/core/inventory'
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
import type { CostPreview, PreviewLine } from '@/components/landed-cost/types'
import { purchaseOrderFormContent } from '@/data/inventory'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { type LoadedPurchaseOrder, toCount } from './form-state'

type ReceiveDialogProps = {
  po: LoadedPurchaseOrder
  costs: CostPreview | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onReceived: () => void
}

type Counts = Record<string, { accepted: string; rejected: string }>

const outstandingLines = (po: LoadedPurchaseOrder) => po.lines.filter((l) => remainingOf(l) > 0)

/** The variant's cost if `accepted` units land at this line's landed cost; null for none. */
function costAfter(preview: PreviewLine | undefined, accepted: number): number | null {
  if (!preview || accepted <= 0) return null
  return weightedAverageCost({
    onHandBefore: preview.onHand,
    costBefore: preview.currentCostPaise,
    receivedQty: accepted,
    landedUnitPaise: preview.landedUnitPaise,
  })
}

/**
 * Partial receipt: accepted and rejected units per outstanding line. Accepted units go on hand
 * at the destination at their landed cost, and the dialog shows what the product's cost
 * becomes; rejected units only stop being incoming.
 */
export default function ReceiveDialog({
  po,
  costs,
  open,
  onOpenChange,
  onReceived,
}: ReceiveDialogProps) {
  // Hooks
  const { receiving: copy } = useCopy(purchaseOrderFormContent)
  const fmt = useFormat()
  const [counts, setCounts] = useState<Counts>({})
  const [busy, setBusy] = useState(false)

  // Helpers
  const countOf = (lineId: string) => ({
    accepted: toCount(counts[lineId]?.accepted ?? ''),
    rejected: toCount(counts[lineId]?.rejected ?? ''),
  })

  const setCount = (lineId: string, key: 'accepted' | 'rejected', value: string) =>
    setCounts({
      ...counts,
      [lineId]: { accepted: '', rejected: '', ...counts[lineId], [key]: value },
    })

  // Event handlers
  const handleAll = () =>
    setCounts(
      Object.fromEntries(
        outstandingLines(po).map((l) => [l.id, { accepted: String(remainingOf(l)), rejected: '' }]),
      ),
    )

  const handleReceive = async () => {
    const lines = outstandingLines(po)
    if (lines.some((l) => countOf(l.id).accepted + countOf(l.id).rejected > remainingOf(l))) {
      toast.error(copy.tooMany)
      return
    }
    const receipts = lines
      .map((l) => ({ lineId: l.id, ...countOf(l.id) }))
      .filter((r) => r.accepted + r.rejected > 0)
    if (receipts.length === 0) {
      toast.error(copy.nothing)
      return
    }
    setBusy(true)
    try {
      const result = await api.purchaseOrders.receive({ id: po.id, receipts })
      toast.success(
        result.rejected > 0
          ? copy.doneRejected(result.units, result.rejected)
          : copy.done(result.units),
      )
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
  const preview = new Map((costs?.lines ?? []).map((l) => [l.lineId, l]))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.body}</DialogDescription>
        </DialogHeader>
        <ul className="flex max-h-[26rem] flex-col overflow-y-auto">
          <li className="grid grid-cols-[minmax(0,1fr)_4.5rem_4.5rem] gap-3 pb-2 text-caption font-medium text-muted-foreground">
            <span />
            <span className="text-right">{copy.accepted}</span>
            <span className="text-right">{copy.rejected}</span>
          </li>
          {outstanding.map((l) => {
            const line = preview.get(l.id)
            const after = costAfter(line, countOf(l.id).accepted)
            const before = line?.onHand && line.onHand > 0 ? line.currentCostPaise : null
            return (
              <li
                key={l.id}
                className="grid grid-cols-[minmax(0,1fr)_4.5rem_4.5rem] items-center gap-3 border-line border-b py-2 last:border-b-0"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <KitThumb src={l.imageUrl} alt="" />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-body">{variantLabel(l)}</span>
                    <span className="text-caption text-muted-foreground">
                      {copy.outstanding(remainingOf(l))}
                    </span>
                    {after === null ? null : (
                      <span className="text-caption text-muted-foreground tabular-nums">
                        {before === null
                          ? copy.costNew(fmt.money(after))
                          : copy.costChange(fmt.money(before), fmt.money(after))}
                      </span>
                    )}
                  </span>
                </span>
                <Input
                  aria-label={`${copy.accepted}: ${variantLabel(l)}`}
                  value={counts[l.id]?.accepted ?? ''}
                  inputMode="numeric"
                  placeholder="0"
                  className="text-right tabular-nums"
                  onChange={(e) => setCount(l.id, 'accepted', e.target.value)}
                />
                <Input
                  aria-label={`${copy.rejected}: ${variantLabel(l)}`}
                  value={counts[l.id]?.rejected ?? ''}
                  inputMode="numeric"
                  placeholder="0"
                  className="text-right tabular-nums"
                  onChange={(e) => setCount(l.id, 'rejected', e.target.value)}
                />
              </li>
            )
          })}
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
