'use client'

import { type PurchaseCurrency, parseAmountMinor } from '@commerce/core/inventory'
import { Plus, Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import { useState } from 'react'
import { variantLabel } from '@/components/inventory/variant-picker'
import KitIconButton from '@/components/kit/kit-icon-button'
import KitThumb from '@/components/kit/kit-thumb'
import DataCard from '@/components/layout/data-card'
import EmptyState from '@/components/layout/empty-state'
import SelectProductsDialog, {
  type PickedProducts,
} from '@/components/products/select-products-dialog'
import { purchaseOrderFormContent } from '@/data/inventory'
import { useCopy } from '@/hooks/use-copy'
import { formatMinor } from '@/lib/money'
import { addPickedLines, type PoLine, toCount } from './form-state'

type PoLinesCardProps = {
  lines: PoLine[]
  currency: PurchaseCurrency
  /** Products and quantities are fixed (goods arrived, on a shipment, or cancelled). */
  locked: boolean
  /** Unit prices are fixed (on a shipment, or cancelled); after arrival they can be corrected. */
  pricesLocked: boolean
  /** HSN codes stay editable until the order is finished. */
  hsnLocked: boolean
  /** Show how much of each line has arrived. */
  showReceived: boolean
  onChange: (lines: PoLine[]) => void
}

const ROW = 'grid-cols-[minmax(0,1fr)_4.5rem_6.5rem_6rem_6.5rem_2.5rem]'

function arrived(line: PoLine): string {
  const base = `${line.received} / ${toCount(line.quantity)}`
  return line.rejected > 0 ? `${base} (−${line.rejected})` : base
}

function badPrice(line: PoLine, currency: PurchaseCurrency): boolean {
  return line.unitPrice.trim() !== '' && parseAmountMinor(line.unitPrice, currency) === null
}

/**
 * Variants on the order with quantity, unit price in the order's currency and HSN code.
 * Products are added through the shared Select products dialog.
 */
export default function PoLinesCard({
  lines,
  currency,
  locked,
  pricesLocked,
  hsnLocked,
  showReceived,
  onChange,
}: PoLinesCardProps) {
  // Hooks
  const { lines: copy } = useCopy(purchaseOrderFormContent)
  const [picking, setPicking] = useState(false)

  // Helpers
  const patchLine = (index: number, patch: Partial<PoLine>) =>
    onChange(lines.map((l, i) => (i === index ? { ...l, ...patch } : l)))

  const lineTotal = (line: PoLine) =>
    formatMinor(
      toCount(line.quantity) * (parseAmountMinor(line.unitPrice, currency) ?? 0),
      currency,
    )

  // Event handlers
  const handlePick = (picked: PickedProducts) => onChange(addPickedLines(lines, picked, currency))

  const handleRemove = (index: number) => onChange(lines.filter((_, i) => i !== index))

  // Render logic
  return (
    <DataCard
      title={copy.heading}
      count={lines.length}
      flush
      action={
        locked ? null : (
          <Button variant="outline" size="sm" onClick={() => setPicking(true)}>
            <Plus aria-hidden="true" />
            {copy.add}
          </Button>
        )
      }
    >
      {lines.length === 0 ? (
        <EmptyState
          variant="plain"
          size="lg"
          className="border-line border-t px-5"
          body={copy.empty}
        />
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
                disabled={pricesLocked}
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
              {locked || line.received + line.rejected > 0 ? (
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
      {locked ? null : (
        <SelectProductsDialog open={picking} onOpenChange={setPicking} onConfirm={handlePick} />
      )}
    </DataCard>
  )
}
