'use client'

import { Minus, Plus } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { useState } from 'react'
import { toast } from 'sonner'
import ProductThumb from '@/components/products/product-thumb'
import { createShipmentContent } from '@/data/create-shipment'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import type { DraftParcel } from './flow-state'

type PartialPickerProps = {
  orderId: string
  /** The parcel's fulfilment order; null when the order ships whole (no parcel rows). */
  parcelId: string | null
  lines: DraftParcel['lines']
  /** After the split: reload the order so the package matches what ships now. */
  onSplit: () => void
}

/** "Glasspad, Wrist Rest × 2": the items a parcel holds. */
const itemList = (rows: Array<{ title: string; n: number }>) =>
  rows
    .filter((r) => r.n > 0)
    .map((r) => (r.n > 1 ? `${r.title} × ${r.n}` : r.title))
    .join(', ')

/**
 * Items in this parcel (Figma 916:10179): a tick on the left for each item that ships now, its
 * picture, price and weight, and how many of it go. Unticking some shows Parcel 1 (ships now)
 * beside Parcel 2 (stays in To ship); Ship only these moves the rest to that new parcel, so
 * nothing is cloned or added by hand. One unit in all: the list alone, nothing to pick.
 */
export default function PartialPicker({ orderId, parcelId, lines, onSplit }: PartialPickerProps) {
  // Hooks
  const copy = useCopy(createShipmentContent.partial)
  const pkg = useCopy(createShipmentContent.package)
  const fmt = useFormat()
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

  // Render logic
  const units = lines.reduce((n, l) => n + l.quantity, 0)
  const pickable = parcelId !== null && units > 1
  const now = lines.reduce((n, l) => n + (counts[l.id] ?? 0), 0)
  const partial = pickable && now > 0 && now < units
  const nowItems = itemList(lines.map((l) => ({ title: l.title, n: counts[l.id] ?? 0 })))
  const laterItems = itemList(
    lines.map((l) => ({ title: l.title, n: l.quantity - (counts[l.id] ?? 0) })),
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-lg border border-hairline">
        <div className="flex items-center justify-between bg-muted/50 px-3 py-2 text-caption font-medium uppercase tracking-wide text-muted-foreground">
          <span>{copy.heading}</span>
          {pickable ? <span className="normal-case">{copy.shipNow}</span> : null}
        </div>
        <ul className="flex flex-col divide-y divide-hairline">
          {lines.map((l) => {
            const n = counts[l.id] ?? 0
            const sub = [
              l.sku ? pkg.sku(l.sku) : null,
              fmt.money(l.unitPricePaise),
              l.weightGrams ? pkg.unitWeight(fmt.number(l.weightGrams)) : null,
            ]
              .filter(Boolean)
              .join(' · ')
            return (
              <li
                key={l.id}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5',
                  pickable && n === 0 && 'opacity-60',
                )}
              >
                {pickable ? (
                  <Checkbox
                    checked={n > 0}
                    aria-label={copy.tick(l.title)}
                    onCheckedChange={(on) => set(l.id, on ? l.quantity : 0, l.quantity)}
                  />
                ) : null}
                <ProductThumb url={l.imageUrl} alt={l.title} className="size-10" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-body font-medium text-ink-strong">{l.title}</span>
                  <span className="truncate text-caption text-muted-foreground">{sub}</span>
                </div>
                {pickable ? (
                  <span className="flex shrink-0 items-center gap-1 rounded-md border border-border p-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label={copy.less(l.title)}
                      disabled={n <= 0}
                      onClick={() => set(l.id, n - 1, l.quantity)}
                    >
                      <Minus aria-hidden="true" />
                    </Button>
                    <span className="w-12 text-center text-body tabular-nums">
                      {copy.of(n, l.quantity)}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label={copy.more(l.title)}
                      disabled={n >= l.quantity}
                      onClick={() => set(l.id, n + 1, l.quantity)}
                    >
                      <Plus aria-hidden="true" />
                    </Button>
                  </span>
                ) : (
                  <span className="shrink-0 tabular-nums text-body text-muted-foreground">
                    × {l.quantity}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      </div>
      {partial ? (
        <div className="flex flex-col gap-3 rounded-lg bg-muted px-3 py-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-0.5">
              <span className="text-body font-medium text-ink-strong">{copy.parcelNow}</span>
              <span className="text-caption text-muted-foreground">
                {copy.itemCount(now)} · {nowItems}
              </span>
              <span className="text-caption text-muted-foreground">{copy.parcelNowHelp}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-body font-medium text-ink-strong">{copy.parcelLater}</span>
              <span className="text-caption text-muted-foreground">
                {copy.itemCount(units - now)} · {laterItems}
              </span>
              <span className="text-caption text-muted-foreground">{copy.parcelLaterHelp}</span>
            </div>
          </div>
          <Button size="sm" className="w-fit" loading={busy} onClick={() => void handleSplit()}>
            {copy.split}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
