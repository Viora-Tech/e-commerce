'use client'

import { type PurchaseCurrency, parseAmountMinor } from '@commerce/core/inventory'
import { Trash2 } from '@commerce/ui/icons'
import { Card, CardContent, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { Input } from '@commerce/ui/shadcn/input'
import VariantPicker, { type VariantHit, variantLabel } from '@/components/inventory/variant-picker'
import KitIconButton from '@/components/kit/kit-icon-button'
import KitThumb from '@/components/kit/kit-thumb'
import { purchaseOrderFormContent } from '@/data/inventory'
import { formatMinor } from '@/lib/money'
import { type PoLine, toCount } from './form-state'

type PoLinesCardProps = {
  lines: PoLine[]
  locationId: string
  currency: PurchaseCurrency
  /** Products, quantities and prices are fixed once the order is placed. */
  locked: boolean
  /** HSN codes stay editable until the order is finished. */
  hsnLocked: boolean
  /** Show how much of each line has arrived. */
  showReceived: boolean
  onChange: (lines: PoLine[]) => void
}

const copy = purchaseOrderFormContent.lines
const ROW = 'grid-cols-[minmax(0,1fr)_4.5rem_6.5rem_6rem_6.5rem_2.5rem]'

/** A new line's price: the variant's cost when buying in rupees, blank otherwise. */
function lineFromHit(hit: VariantHit, currency: PurchaseCurrency): PoLine {
  return {
    variantId: hit.variantId,
    productTitle: hit.productTitle,
    variantTitle: hit.variantTitle,
    sku: hit.sku,
    imageUrl: hit.imageUrl,
    quantity: '1',
    unitPrice: currency === 'INR' && hit.costPaise ? String(hit.costPaise / 100) : '',
    hsnCode: '',
    received: 0,
    rejected: 0,
  }
}

function arrived(line: PoLine): string {
  const base = `${line.received} / ${toCount(line.quantity)}`
  return line.rejected > 0 ? `${base} (−${line.rejected})` : base
}

function badPrice(line: PoLine, currency: PurchaseCurrency): boolean {
  return line.unitPrice.trim() !== '' && parseAmountMinor(line.unitPrice, currency) === null
}

/** Variants on the order with quantity, unit price in the order's currency and HSN code. */
export default function PoLinesCard({
  lines,
  locationId,
  currency,
  locked,
  hsnLocked,
  showReceived,
  onChange,
}: PoLinesCardProps) {
  // Helpers
  const patchLine = (index: number, patch: Partial<PoLine>) =>
    onChange(lines.map((l, i) => (i === index ? { ...l, ...patch } : l)))

  const lineTotal = (line: PoLine) =>
    formatMinor(
      toCount(line.quantity) * (parseAmountMinor(line.unitPrice, currency) ?? 0),
      currency,
    )

  // Event handlers
  const handlePick = (hit: VariantHit) => onChange([...lines, lineFromHit(hit, currency)])

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
          <li
            className={`hidden h-10 ${ROW} items-center gap-3 border-line border-y bg-muted/50 px-5 text-caption font-medium text-muted-foreground sm:grid`}
          >
            <span />
            <span className="text-right">{copy.quantity}</span>
            <span className="text-right">
              {copy.cost} ({currency})
            </span>
            <span>{copy.hsn}</span>
            <span className="text-right">{showReceived ? copy.received : copy.lineTotal}</span>
            <span />
          </li>
          {lines.map((line, i) => (
            <li
              key={line.variantId}
              className={`grid ${ROW} items-center gap-3 border-line border-b px-5 py-3 last:border-b-0`}
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
                value={line.unitPrice}
                inputMode="decimal"
                placeholder="0"
                disabled={locked}
                aria-invalid={badPrice(line, currency) || undefined}
                className="text-right tabular-nums"
                onChange={(e) => patchLine(i, { unitPrice: e.target.value })}
              />
              <Input
                aria-label={copy.hsn}
                value={line.hsnCode}
                inputMode="numeric"
                maxLength={8}
                placeholder="0000"
                disabled={hsnLocked}
                className="tabular-nums"
                onChange={(e) => patchLine(i, { hsnCode: e.target.value })}
              />
              <span className="text-right text-body tabular-nums">
                {showReceived ? arrived(line) : lineTotal(line)}
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
