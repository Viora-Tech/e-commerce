'use client'

import type { InventoryReason } from '@commerce/core/catalog'
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
import { productFormContent } from '@/data/products'
import type { VariantRow } from './form-state'

type ProductStockSectionProps = {
  variant: VariantRow
  featured: boolean
  /** Quantity differs from what is saved, so a reason is needed. */
  quantityChanged: boolean
  reason: InventoryReason
  onVariant: (patch: Partial<VariantRow>) => void
  onFeatured: (value: boolean) => void
  onReason: (reason: InventoryReason) => void
}

const copy = productFormContent.inventory

const reasonItems = Object.fromEntries(copy.reasons.map((r) => [r.value, r.label]))

const LOW_STOCK = 5

/** What the storefront would say about this variant right now. */
function stockState(variant: VariantRow): string {
  if (!variant.trackInventory) return copy.stockStates.unlimited
  const quantity = Number(variant.quantity)
  if (!Number.isFinite(quantity) || quantity <= 0) return copy.stockStates.out
  return quantity <= LOW_STOCK ? copy.stockStates.low : copy.stockStates.inStock
}

/** Frame 5:5179 and 5:5196: quantity beside a derived status, then the unlimited toggle and the featured tick. */
export default function ProductStockSection({
  variant,
  featured,
  quantityChanged,
  reason,
  onVariant,
  onFeatured,
  onReason,
}: ProductStockSectionProps) {
  // Event handlers
  const handleUnlimited = (unlimited: boolean) => onVariant({ trackInventory: !unlimited })

  // Render logic
  const unlimited = !variant.trackInventory

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
          <Input size="kit" value={stockState(variant)} readOnly aria-label={copy.stockStatus} />
        </KitField>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:gap-4">
        <KitField label={copy.sku} htmlFor="variant-sku">
          <Input
            size="kit"
            id="variant-sku"
            value={variant.sku}
            onChange={(e) => onVariant({ sku: e.target.value })}
            autoComplete="off"
          />
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
