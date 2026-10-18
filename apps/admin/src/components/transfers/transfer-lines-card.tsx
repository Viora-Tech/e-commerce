'use client'

import { Trash2 } from '@commerce/ui/icons'

import { Input } from '@commerce/ui/shadcn/input'
import VariantPicker, { type VariantHit, variantLabel } from '@/components/inventory/variant-picker'
import KitIconButton from '@/components/kit/kit-icon-button'
import KitThumb from '@/components/kit/kit-thumb'
import DataCard from '@/components/layout/data-card'
import EmptyState from '@/components/layout/empty-state'
import { transferFormContent } from '@/data/inventory'

export type TransferLine = {
  variantId: string
  productTitle: string
  variantTitle: string
  sku: string | null
  imageUrl: string | null
  quantity: string
  /** Available at the origin when the line was picked; unknown for saved lines. */
  available: number | null
}

type TransferLinesCardProps = {
  lines: TransferLine[]
  fromLocationId: string
  locked: boolean
  onChange: (lines: TransferLine[]) => void
}

const copy = transferFormContent.lines

function lineFromHit(hit: VariantHit): TransferLine {
  return {
    variantId: hit.variantId,
    productTitle: hit.productTitle,
    variantTitle: hit.variantTitle,
    sku: hit.sku,
    imageUrl: hit.imageUrl,
    quantity: '1',
    available: hit.available,
  }
}

/** Variants being moved and how many of each. */
export default function TransferLinesCard({
  lines,
  fromLocationId,
  locked,
  onChange,
}: TransferLinesCardProps) {
  // Event handlers
  const handlePick = (hit: VariantHit) => onChange([...lines, lineFromHit(hit)])

  const handleQuantity = (index: number, quantity: string) =>
    onChange(lines.map((l, i) => (i === index ? { ...l, quantity } : l)))

  const handleRemove = (index: number) => onChange(lines.filter((_, i) => i !== index))

  // Render logic
  return (
    <DataCard title={copy.heading} count={lines.length} flush>
      {locked ? null : (
        <div className="px-5 pb-4">
          <VariantPicker
            placeholder={copy.search}
            locationId={fromLocationId || undefined}
            pickedIds={lines.map((l) => l.variantId)}
            onPick={handlePick}
          />
        </div>
      )}
      {lines.length === 0 ? (
        <EmptyState
          variant="plain"
          size="lg"
          className="border-line border-t px-5"
          body={copy.empty}
        />
      ) : (
        <ul className="flex flex-col border-line border-t">
          {lines.map((line, i) => (
            <li
              key={line.variantId}
              className="flex items-center gap-3 border-line border-b px-5 py-3 last:border-b-0"
            >
              <KitThumb src={line.imageUrl} alt="" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-body">{variantLabel(line)}</span>
                <span className="truncate text-caption text-muted-foreground">
                  {line.available === null
                    ? (line.sku ?? copy.noSku)
                    : copy.atOrigin(line.available)}
                </span>
              </span>
              <Input
                aria-label={copy.quantity}
                value={line.quantity}
                inputMode="numeric"
                disabled={locked}
                className="w-20 text-right tabular-nums"
                onChange={(e) => handleQuantity(i, e.target.value)}
              />
              {locked ? null : (
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
    </DataCard>
  )
}
