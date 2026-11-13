'use client'

import type { ParcelSplitReason } from '@commerce/core'
import { Minus, Plus } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@commerce/ui/shadcn/select'
import { Switch } from '@commerce/ui/shadcn/switch'
import StatusChip from '@/components/layout/status-chip'
import ProductThumb from '@/components/products/product-thumb'
import { createShipmentContent } from '@/data/create-shipment'
import { useCopy, useFormat } from '@/hooks/use-copy'
import type { DraftParcel } from './flow-state'
import { availabilityNote, isPartial, type SplitPlan } from './partial-plan'

type PartialPickerProps = {
  /** The parcel's fulfilment order; null when the order ships whole (no parcel rows). */
  parcelId: string | null
  lines: DraftParcel['lines']
  /** Null until the parcel loads: nothing shows. */
  plan: SplitPlan | null
  onPlan: (next: SplitPlan) => void
  /** How many parts the order ships in once this parcel is split. */
  parts: number
}

const REASONS: ParcelSplitReason[] = [
  'not_ready',
  'preorder',
  'out_of_stock',
  'customer_asked',
  'other',
]

/** "Glasspad, Wrist Rest × 2": the items a parcel holds. */
const itemList = (rows: Array<{ title: string; n: number }>) =>
  rows
    .filter((r) => r.n > 0)
    .map((r) => (r.n > 1 ? `${r.title} × ${r.n}` : r.title))
    .join(', ')

/**
 * Items in this parcel (Figma 916:10179): a tick for each item that ships now, its picture, a
 * chip when it waits ("Pre-order · arrives 22 Oct", "1 of 2 in stock") and how many of it go.
 * What is on the shelf starts ticked. Unticking some shows Parcel 1 (ships now) beside Parcel 2
 * (stays in To ship), the reason and whether the customer is told; the page splits the parcel
 * as it books, so there is no separate step. One unit in all: the list alone, nothing to pick.
 */
export default function PartialPicker({
  parcelId,
  lines,
  plan,
  onPlan,
  parts,
}: PartialPickerProps) {
  // Hooks
  const copy = useCopy(createShipmentContent.partial)
  const pkg = useCopy(createShipmentContent.package)
  const fmt = useFormat()

  // Helpers
  const set = (id: string, next: number, max: number) =>
    plan && onPlan({ ...plan, counts: { ...plan.counts, [id]: Math.max(0, Math.min(max, next)) } })
  const shortDate = (day: string) => fmt.pattern(day, { day: 'numeric', month: 'short' })

  // Early returns
  if (!plan) return null

  // Render logic
  const { counts } = plan
  const units = lines.reduce((n, l) => n + l.quantity, 0)
  const pickable = parcelId !== null && units > 1
  const now = lines.reduce((n, l) => n + (counts[l.id] ?? 0), 0)
  const partial = pickable && isPartial(lines, counts)
  const nowItems = itemList(lines.map((l) => ({ title: l.title, n: counts[l.id] ?? 0 })))
  const laterItems = itemList(
    lines.map((l) => ({ title: l.title, n: l.quantity - (counts[l.id] ?? 0) })),
  )
  const thisParcel = lines
    .filter((l) => (counts[l.id] ?? 0) > 0)
    .map((l) => `${l.title} × ${counts[l.id]}`)
    .join(' · ')
  const reasonItems = Object.fromEntries(REASONS.map((r) => [r, copy.reasonValue(copy.reasons[r])]))

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
            const note = availabilityNote(l.availability, l.quantity)
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
                  <span className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="truncate text-body font-medium text-ink-strong">
                      {l.title}
                    </span>
                    {note ? (
                      <StatusChip tone="attention">
                        {note.kind === 'preorder'
                          ? copy.preorder(note.date ? shortDate(note.date) : null)
                          : copy.inStock(note.n, l.quantity)}
                      </StatusChip>
                    ) : null}
                  </span>
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
          <div className="grid items-center gap-3 sm:grid-cols-2">
            <Select
              items={reasonItems}
              value={plan.reason}
              onValueChange={(v) => v && onPlan({ ...plan, reason: v as ParcelSplitReason })}
            >
              <SelectTrigger aria-label={copy.reasonLabel} className="w-full bg-background">
                {copy.reasonValue(copy.reasons[plan.reason])}
              </SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {copy.reasons[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="flex items-center gap-2">
              <Switch
                id="partial-notify"
                checked={plan.notify}
                onCheckedChange={(on) => onPlan({ ...plan, notify: on })}
              />
              <label htmlFor="partial-notify" className="text-caption text-ink-strong">
                {copy.notify(parts)}
              </label>
            </span>
          </div>
        </div>
      ) : null}
      {partial ? (
        <p className="text-caption text-muted-foreground">{copy.thisParcel(thisParcel)}</p>
      ) : null}
    </div>
  )
}
