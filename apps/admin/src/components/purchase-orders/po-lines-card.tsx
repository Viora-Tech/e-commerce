'use client'

import { parseRupees } from '@commerce/money'
import { Trash2 } from '@commerce/ui/icons'
import { Card, CardContent, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { Input } from '@commerce/ui/shadcn/input'
import VariantPicker, { type VariantHit, variantLabel } from '@/components/inventory/variant-picker'
import KitIconButton from '@/components/kit/kit-icon-button'
import KitThumb from '@/components/kit/kit-thumb'
import { purchaseOrderFormContent } from '@/data/inventory'
import { formatPaise } from '@/lib/money'
import { type PoLine, toCount } from './form-state'

type PoLinesCardProps = {
  lines: PoLine[]
  locationId: string
  /** Lines are fixed once the order is placed. */
  locked: boolean
  /** Show how much of each line has arrived. */
  showReceived: boolean
  onChange: (lines: PoLine[]) => void
}

const copy = purchaseOrderFormContent.lines

function lineFromHit(hit: VariantHit): PoLine {
  return {
    variantId: hit.variantId,
    productTitle: hit.productTitle,
    variantTitle: hit.variantTitle,
    sku: hit.sku,
    imageUrl: hit.imageUrl,
    quantity: '1',
    unitCost: hit.costPaise ? String(hit.costPaise / 100) : '',
    received: 0,
  }
}

/** Variants on the order with quantity and unit cost, added from a search. */
export default function PoLinesCard({
  lines,
  locationId,
  locked,
  showReceived,
  onChange,
}: PoLinesCardProps) {
  // Helpers
  const patchLine = (index: number, patch: Partial<PoLine>) =>
    onChange(lines.map((l, i) => (i === index ? { ...l, ...patch } : l)))

  // Event handlers
  const handlePick = (hit: VariantHit) => onChange([...lines, lineFromHit(hit)])

  const handleRemove = (index: number) => onChange(lines.filter((_, i) => i !== index))

  // Render logic
  return (
    <Card size="form" gap="none" inset="y-none">
      <CardHeader className="grid-cols-[1fr_auto] items-center py-5">
        <CardTitle className="flex items-center gap-2">
          {copy.heading}
          <span className="rounded-full bg-muted px-2 py-0.5 text-caption font-medium text-muted-foreground tabular-nums">
            {lines.length}
          </span>
        </CardTitle>
      </CardHeader>
      {locked ? null : (
        <CardContent className="pb-4">
          <VariantPicker
            placeholder={copy.search}
            locationId={locationId}
            pickedIds={lines.map((l) => l.variantId)}
            onPick={handlePick}
          />
        </CardContent>
      )}
      {lines.length === 0 ? (
        <p className="border-line border-t px-5 py-10 text-center text-body text-muted-foreground">
          {copy.empty}
        </p>
      ) : (
        <ul className="flex flex-col">
          <li className="hidden h-10 grid-cols-[minmax(0,1fr)_5rem_7rem_6rem_2.5rem] items-center gap-3 border-line border-y bg-muted/50 px-5 text-caption font-medium text-muted-foreground sm:grid">
            <span />
            <span className="text-right">{copy.quantity}</span>
            <span className="text-right">{copy.cost}</span>
            <span className="text-right">{showReceived ? copy.received : copy.lineTotal}</span>
            <span />
          </li>
          {lines.map((line, i) => (
            <li
              key={line.variantId}
              className="grid grid-cols-[minmax(0,1fr)_5rem_7rem_6rem_2.5rem] items-center gap-3 border-line border-b px-5 py-3 last:border-b-0"
            >
              <span className="flex min-w-0 items-center gap-3">
                <KitThumb src={line.imageUrl} alt="" />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-body">{variantLabel(line)}</span>
                  <span className="truncate text-caption text-muted-foreground">
                    {line.sku ?? copy.noSku}
                  </span>
                </span>
              </span>
              <Input
                aria-label={copy.quantity}
                value={line.quantity}
                inputMode="numeric"
                disabled={locked}
                className="text-right tabular-nums"
                onChange={(e) => patchLine(i, { quantity: e.target.value })}
              />
              <Input
                aria-label={copy.cost}
                value={line.unitCost}
                inputMode="decimal"
                placeholder="0"
                disabled={locked}
                className="text-right tabular-nums"
                onChange={(e) => patchLine(i, { unitCost: e.target.value })}
              />
              <span className="text-right text-body tabular-nums">
                {showReceived
                  ? `${line.received} / ${toCount(line.quantity)}`
                  : formatPaise(toCount(line.quantity) * (parseRupees(line.unitCost) ?? 0))}
              </span>
              {locked ? (
                <span />
              ) : (
                <KitIconButton
                  label={copy.remove}
                  className="size-9"
                  onClick={() => handleRemove(i)}
                >
                  <Trash2 aria-hidden="true" />
                </KitIconButton>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
