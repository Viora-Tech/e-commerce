'use client'

import { Plus, X } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import { useState } from 'react'
import LineItemRow from '@/components/layout/line-item-row'
import SelectProductsDialog, {
  type PickedProducts,
} from '@/components/products/select-products-dialog'
import { deliveryOptionsContent } from '@/data/delivery-options'
import { useCopy, useLocale } from '@/hooks/use-copy'
import { formatPaise } from '@/lib/money'

/** One picked variant in Try a PIN's "Products I pick" mode. */
export type TryPinLine = {
  variantId: string
  title: string
  imageUrl: string | null
  unitPricePaise: number
  quantity: number
}

type TryPinLinesProps = {
  lines: TryPinLine[]
  onChange: (lines: TryPinLine[]) => void
}

const isDefault = (variantTitle: string) => !variantTitle || variantTitle === 'Default'

/** The picker's ticks added to the lines: a variant already there gets one more. */
function addPicked(lines: TryPinLine[], picked: PickedProducts): TryPinLine[] {
  const next = [...lines]
  for (const { product, variantIds } of picked) {
    for (const variantId of variantIds) {
      const v = product.variants.find((x) => x.id === variantId)
      if (!v) continue
      const at = next.findIndex((l) => l.variantId === variantId)
      const existing = next[at]
      if (existing) {
        next[at] = { ...existing, quantity: Math.min(999, existing.quantity + 1) }
        continue
      }
      next.push({
        variantId,
        title: isDefault(v.title) ? product.title : `${product.title} / ${v.title}`,
        imageUrl: product.imageUrl,
        unitPricePaise: v.pricePaise ?? 0,
        quantity: 1,
      })
    }
  }
  return next
}

/** Try a PIN's cart: products and quantities picked with the shared Select products dialog. */
export default function TryPinLines({ lines, onChange }: TryPinLinesProps) {
  // Hooks
  const copy = useCopy(deliveryOptionsContent)
  const locale = useLocale()
  const [picking, setPicking] = useState(false)

  // Event handlers
  const handleQuantity = (variantId: string, value: string) => {
    const quantity = Math.min(999, Math.max(1, Number.parseInt(value, 10) || 1))
    onChange(lines.map((l) => (l.variantId === variantId ? { ...l, quantity } : l)))
  }

  const handleRemove = (variantId: string) => {
    onChange(lines.filter((l) => l.variantId !== variantId))
  }

  // Render logic
  const t = copy.tryPin

  return (
    <div className="flex flex-col gap-3">
      {lines.length === 0 ? (
        <p className="text-body text-muted-foreground">{t.noLines}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {lines.map((l) => (
            <LineItemRow
              key={l.variantId}
              imageUrl={l.imageUrl}
              title={l.title}
              controls={
                <Input
                  aria-label={t.quantity(l.title)}
                  type="number"
                  min={1}
                  max={999}
                  value={l.quantity}
                  onChange={(e) => handleQuantity(l.variantId, e.target.value)}
                  className="w-20 text-right tabular-nums"
                />
              }
              amount={formatPaise(l.quantity * l.unitPricePaise, locale)}
              aside={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t.remove(l.title)}
                  onClick={() => handleRemove(l.variantId)}
                >
                  <X />
                </Button>
              }
            />
          ))}
        </ul>
      )}
      <div>
        <Button variant="outline" onClick={() => setPicking(true)}>
          <Plus aria-hidden="true" />
          {t.addProducts}
        </Button>
      </div>
      <SelectProductsDialog
        open={picking}
        onOpenChange={setPicking}
        onConfirm={(picked) => onChange(addPicked(lines, picked))}
      />
    </div>
  )
}
