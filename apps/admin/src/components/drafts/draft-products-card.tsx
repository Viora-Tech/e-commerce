'use client'

import { Plus, Search, X } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import { useState } from 'react'
import DraftCustomItemDialog from '@/components/drafts/draft-custom-item-dialog'
import type { DraftLine } from '@/components/drafts/draft-form-state'
import DraftMoneyInput from '@/components/drafts/draft-money-input'
import DataCard from '@/components/layout/data-card'
import LineItemRow from '@/components/layout/line-item-row'
import SelectProductsDialog, {
  type PickedProducts,
} from '@/components/products/select-products-dialog'
import { draftEditorContent } from '@/data/drafts'
import { useCopy } from '@/hooks/use-copy'
import { formatPaise } from '@/lib/money'

type DraftProductsCardProps = {
  lines: DraftLine[]
  onChange: (lines: DraftLine[]) => void
}

const isDefault = (variantTitle: string) => !variantTitle || variantTitle === 'Default'

const lineTitle = (l: { title: string; variantTitle: string }) =>
  isDefault(l.variantTitle) ? l.title : `${l.title} / ${l.variantTitle}`

/**
 * The ticked variants as draft lines. A variant already on the draft gets one more; the rest are
 * added at their catalogue price (₹0 when listed without one, for the merchant to type).
 */
function addPicked(lines: DraftLine[], picked: PickedProducts): DraftLine[] {
  const next = [...lines]
  for (const { product, variantIds } of picked) {
    for (const variantId of variantIds) {
      const v = product.variants.find((x) => x.id === variantId)
      if (!v) continue
      const at = next.findIndex((l) => l.key === variantId)
      const existing = next[at]
      if (existing) {
        next[at] = { ...existing, quantity: Math.min(999, existing.quantity + 1) }
        continue
      }
      next.push({
        key: variantId,
        variantId,
        title: product.title,
        variantTitle: v.title,
        sku: v.sku,
        quantity: 1,
        unitPricePaise: v.pricePaise ?? 0,
        imageUrl: product.imageUrl,
        giftCard: product.giftCard,
      })
    }
  }
  return next
}

/**
 * The draft's lines (Figma "Products"): typing in the search or pressing Browse opens the shared
 * product picker (photos, stock, many variants at once, audit #27); "Add custom item" adds a
 * one-off line that is not in the catalogue (#28).
 */
export default function DraftProductsCard({ lines, onChange }: DraftProductsCardProps) {
  // Hooks
  const copy = useCopy(draftEditorContent)
  const [search, setSearch] = useState('')
  const [picking, setPicking] = useState(false)
  const [addingCustom, setAddingCustom] = useState(false)

  // Event handlers
  const handleSearch = (value: string) => {
    setSearch(value)
    if (value.trim()) setPicking(true)
  }

  const handlePickerOpen = (open: boolean) => {
    setPicking(open)
    if (!open) setSearch('')
  }

  const handleQuantity = (key: string, value: string) => {
    const quantity = Math.min(999, Math.max(1, Number.parseInt(value, 10) || 1))
    onChange(lines.map((l) => (l.key === key ? { ...l, quantity } : l)))
  }

  const handlePrice = (key: string, unitPricePaise: number) => {
    onChange(lines.map((l) => (l.key === key ? { ...l, unitPricePaise } : l)))
  }

  const handleRemove = (key: string) => {
    onChange(lines.filter((l) => l.key !== key))
  }

  // Render logic
  return (
    <DataCard title={copy.products.heading}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-48 flex-1">
            <Search
              aria-hidden="true"
              className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 size-4 text-muted-foreground"
            />
            <Input
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder={copy.products.search}
              aria-label={copy.products.search}
              className="pl-9"
            />
          </div>
          <Button variant="outline" onClick={() => setPicking(true)}>
            {copy.products.browse}
          </Button>
          <Button variant="outline" onClick={() => setAddingCustom(true)}>
            <Plus aria-hidden="true" />
            {copy.products.addCustom}
          </Button>
        </div>
        {lines.length === 0 ? (
          <p className="text-body text-muted-foreground">{copy.products.empty}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {lines.map((l) => (
              <LineItemRow
                key={l.key}
                imageUrl={l.imageUrl ?? null}
                title={lineTitle(l)}
                subtitle={
                  l.custom
                    ? [copy.products.customLabel, l.custom.taxable ? null : copy.products.noGst]
                        .filter(Boolean)
                        .join(' · ')
                    : l.sku
                }
                controls={
                  <>
                    <Input
                      aria-label={copy.products.quantity}
                      type="number"
                      min={1}
                      max={999}
                      value={l.quantity}
                      onChange={(e) => handleQuantity(l.key, e.target.value)}
                      className="w-20 text-right tabular-nums"
                    />
                    <DraftMoneyInput
                      aria-label={copy.products.price}
                      valuePaise={l.unitPricePaise}
                      onChangePaise={(paise) => handlePrice(l.key, paise)}
                      className="w-28 text-right tabular-nums"
                    />
                  </>
                }
                amount={formatPaise(l.quantity * l.unitPricePaise)}
                aside={
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={copy.products.remove}
                    onClick={() => handleRemove(l.key)}
                  >
                    <X />
                  </Button>
                }
              />
            ))}
          </ul>
        )}
      </div>
      <SelectProductsDialog
        open={picking}
        onOpenChange={handlePickerOpen}
        initialSearch={search.trim()}
        onConfirm={(picked) => onChange(addPicked(lines, picked))}
      />
      <DraftCustomItemDialog
        open={addingCustom}
        onOpenChange={setAddingCustom}
        onAdd={(line) => onChange([...lines, line])}
      />
    </DataCard>
  )
}
