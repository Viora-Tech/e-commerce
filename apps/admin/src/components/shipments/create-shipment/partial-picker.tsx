'use client'

import { Minus, Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import { toast } from 'sonner'
import { createShipmentContent } from '@/data/create-shipment'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type PartialPickerProps = {
  orderId: string
  /** The parcel's fulfilment order; null when the order ships whole (no parcel rows). */
  parcelId: string | null
  lines: Array<{ id: string; title: string; quantity: number }>
  /** After the split: reload the order so the package matches what ships now. */
  onSplit: () => void
}

/**
 * Partial shipment (Figma 916:10179): how many of each item go now. Ship only these keeps
 * those in this parcel and moves the rest to a new parcel that stays in To ship (Part 2),
 * so nothing is cloned or added by hand.
 */
export default function PartialPicker({ orderId, parcelId, lines, onSplit }: PartialPickerProps) {
  // Hooks
  const copy = useCopy(createShipmentContent.partial)
  const [counts, setCounts] = useState<Record<string, number>>(() =>
    Object.fromEntries(lines.map((l) => [l.id, l.quantity])),
  )
  const [busy, setBusy] = useState(false)

  // Helpers
  const set = (id: string, next: number, max: number) =>
    setCounts((c) => ({ ...c, [id]: Math.max(0, Math.min(max, next)) }))

  // Event handlers
  const handleSplit = async () => {
    if (!parcelId) return
    setBusy(true)
    try {
      await api.shipments.splitParcel({
        orderId,
        fulfillmentOrderId: parcelId,
        keep: lines.map((l) => ({ orderLineId: l.id, quantity: counts[l.id] ?? 0 })),
      })
      toast.success(copy.done)
      onSplit()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  // Early returns
  const units = lines.reduce((n, l) => n + l.quantity, 0)
  if (!parcelId || units < 2) return null

  // Render logic
  const now = lines.reduce((n, l) => n + (counts[l.id] ?? 0), 0)
  const partial = now > 0 && now < units

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-hairline p-3">
      <p className="text-caption font-medium text-muted-foreground">{copy.heading}</p>
      <ul className="flex flex-col divide-y divide-hairline">
        {lines.map((l) => {
          const n = counts[l.id] ?? 0
          return (
            <li key={l.id} className="flex items-center gap-3 py-2">
              <span className="min-w-0 flex-1 truncate text-body text-ink-strong">{l.title}</span>
              <span className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  aria-label={copy.less(l.title)}
                  disabled={n <= 0}
                  onClick={() => set(l.id, n - 1, l.quantity)}
                >
                  <Minus aria-hidden="true" />
                </Button>
                <span className="w-16 text-center text-body tabular-nums">
                  {copy.of(n, l.quantity)}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  aria-label={copy.more(l.title)}
                  disabled={n >= l.quantity}
                  onClick={() => set(l.id, n + 1, l.quantity)}
                >
                  <Plus aria-hidden="true" />
                </Button>
              </span>
            </li>
          )
        })}
      </ul>
      {partial ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted px-3 py-2">
          <span className="text-caption text-muted-foreground">
            {copy.summary(now, units - now)}
          </span>
          <Button size="sm" loading={busy} onClick={() => void handleSplit()}>
            {copy.split}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
