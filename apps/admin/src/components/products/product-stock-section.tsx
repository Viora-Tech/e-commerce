'use client'

import { type InventoryReason, type StockState, stockStateOf } from '@commerce/core/catalog'
import { Button } from '@commerce/ui/shadcn/button'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { Input } from '@commerce/ui/shadcn/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import { Switch } from '@commerce/ui/shadcn/switch'
import MoneyInput from '@/components/fields/money-input'
import KitField from '@/components/kit/kit-field'
import StatusChip from '@/components/layout/status-chip'
import type { ChipTone } from '@/components/status/tone'
import { productFormContent } from '@/data/product-form'
import { useCopy } from '@/hooks/use-copy'
import type { VariantRow } from './form-state'
import { generateSku } from './sku'

type ProductStockSectionProps = {
  variant: VariantRow
  /** Product handle (or title when there is none yet), the stem of a generated SKU. */
  skuStem: string
  /** SKUs of the product's other variants, so a generated one never repeats them. */
  otherSkus: string[]
  /** The store's low-stock threshold (`products.facets`); the default until it loads. */
  lowStockThreshold?: number | undefined
  featured: boolean
  /** Quantity differs from what is saved, so a reason is needed. */
  quantityChanged: boolean
  reason: InventoryReason
  onVariant: (patch: Partial<VariantRow>) => void
  onFeatured: (value: boolean) => void
  onReason: (reason: InventoryReason) => void
}

/** Chip tone per stock state: good, needs attention soon, a problem, or not counted. */
const STOCK_TONE: Record<StockState, ChipTone> = {
  in_stock: 'success',
  low: 'attention',
  out: 'danger',
  unlimited: 'info',
}

/** Frame 5:5179 and 5:5196: quantity beside a derived status, then the unlimited toggle and the featured tick. */
export default function ProductStockSection({
  variant,
  skuStem,
  otherSkus,
  lowStockThreshold,
  featured,
  quantityChanged,
  reason,
  onVariant,
  onFeatured,
  onReason,
}: ProductStockSectionProps) {
  // Hooks
  const { inventory: copy } = useCopy(productFormContent)

  // Event handlers
  const handleUnlimited = (unlimited: boolean) => onVariant({ trackInventory: !unlimited })

  const handleGenerateSku = () =>
    onVariant({ sku: generateSku(skuStem, variant.optionValues, otherSkus) })

  // Render logic
  const reasonItems = Object.fromEntries(copy.reasons.map((r) => [r.value, r.label]))
  const unlimited = !variant.trackInventory
  const state = stockStateOf(
    { trackInventory: variant.trackInventory, available: Number(variant.quantity) },
    lowStockThreshold,
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 md:flex-row md:gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <KitField label={copy.stockQuantity} htmlFor="variant-quantity">
            {unlimited ? (
              <Input size="kit" id="variant-quantity" value={copy.unlimitedValue} readOnly />
            ) : (
              <MoneyInput
                size="kit"
                id="variant-quantity"
                currency={false}
                value={variant.quantity}
                onChange={(quantity) => onVariant({ quantity })}
              />
            )}
          </KitField>
          <div className="flex items-center gap-3">
            <Switch
              id="variant-unlimited"
              checked={unlimited}
              onCheckedChange={(value) => handleUnlimited(Boolean(value))}
            />
            <label htmlFor="variant-unlimited" className="text-body text-foreground">
              {copy.unlimited}
            </label>
          </div>
        </div>
        <KitField label={copy.stockStatus} help={unlimited ? copy.unlimitedHelp : undefined}>
          <div className="flex h-9 items-center">
            <StatusChip tone={STOCK_TONE[state]}>{copy.stockStates[state]}</StatusChip>
          </div>
        </KitField>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:gap-4">
        <KitField label={copy.sku} htmlFor="variant-sku">
          <div className="flex gap-2">
            <Input
              size="kit"
              id="variant-sku"
              value={variant.sku}
              onChange={(e) => onVariant({ sku: e.target.value })}
              autoComplete="off"
            />
            <Button
              type="button"
              variant="outline"
              className="h-9 shrink-0"
              onClick={handleGenerateSku}
              disabled={!skuStem.trim()}
              title={copy.skuGenerateHelp}
            >
              {copy.skuGenerate}
            </Button>
          </div>
        </KitField>
        <KitField label={copy.barcode} htmlFor="variant-barcode">
          <Input
            size="kit"
            id="variant-barcode"
            value={variant.barcode}
            onChange={(e) => onVariant({ barcode: e.target.value })}
            autoComplete="off"
          />
        </KitField>
      </div>

      {quantityChanged ? (
        <KitField label={copy.reason} htmlFor="inventory-reason">
          <Select
            items={reasonItems}
            value={reason}
            onValueChange={(r) => onReason(r as InventoryReason)}
          >
            <SelectTrigger size="lg" id="inventory-reason" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {copy.reasons.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </KitField>
      ) : null}

      <div className="flex items-center gap-2">
        <Checkbox
          id="product-featured"
          checked={featured}
          onCheckedChange={(value) => onFeatured(Boolean(value))}
        />
        <label htmlFor="product-featured" className="text-body text-muted-foreground">
          {copy.featured}
        </label>
      </div>
    </div>
  )
}
