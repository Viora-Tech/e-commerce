'use client'

import type { VariantBox } from '@commerce/core/catalog'
import { TrendingUp } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import { Switch } from '@commerce/ui/shadcn/switch'
import type { ReactNode } from 'react'
import MoneyInput from '@/components/fields/money-input'
import KitField from '@/components/kit/kit-field'
import { COUNTRIES } from '@/data/countries'
import { productFormContent } from '@/data/product-form'
import { productShippingContent } from '@/data/product-shipping'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { margin, type VariantPreorderContext, type VariantRow } from './form-state'
import type { ProductTax } from './product-tax'
import VariantBoxField from './variant-box-field'
import WeightInput from './weight-input'
import ZeroPriceWarning from './zero-price-warning'

type VariantEditFieldsProps = {
  draft: VariantRow
  onPatch: (patch: Partial<VariantRow>) => void
  /** Fills the SKU from the product and this variant's option values. */
  onGenerateSku: () => void
  /** The product's HSN and GST rate; the variant edits its own only when `perVariant` (#63). */
  tax: ProductTax
  /** Whether the product takes pre-orders and the limit a blank field uses. */
  preorder: VariantPreorderContext
  /** The product's Package, for the variant's optional own box (#1517). */
  productBox: VariantBox
}

const NONE = '__none'

/**
 * Every field one variant carries, grouped as Shopify's variant page does: pricing, inventory,
 * tax and shipping. The dialog (`variant-edit-dialog.tsx`) holds the draft these edit.
 */
export default function VariantEditFields({
  draft,
  onPatch,
  onGenerateSku,
  tax,
  preorder,
  productBox,
}: VariantEditFieldsProps) {
  // Hooks
  const formCopy = useCopy(productFormContent)
  const physical = useCopy(productShippingContent)
  const fmt = useFormat()

  // Render logic
  const { pricing, inventory, shipping, variants } = formCopy
  const copy = variants.dialog
  const profit = margin(draft.price, draft.cost)
  const { inherited } = preorder
  const limitPlaceholder =
    inherited.from === 'campaign'
      ? copy.preorderLimitFromCampaign
      : inherited.limit == null
        ? copy.preorderLimitNone
        : copy.preorderLimitFromProduct(fmt.number(inherited.limit))
  const countries = Object.fromEntries([
    [NONE, shipping.countryPlaceholder],
    ...COUNTRIES.map((c) => [c.code, c.name]),
  ])

  return (
    <div className="flex flex-col gap-6">
      <Group title={copy.pricing}>
        <div className="grid gap-4 md:grid-cols-2">
          <KitField label={pricing.price} htmlFor="edit-variant-price" help={pricing.priceHelp}>
            <MoneyInput
              size="kit"
              id="edit-variant-price"
              value={draft.price}
              onChange={(price) => onPatch({ price })}
            />
          </KitField>
          <KitField label={`${pricing.mrp} ${pricing.mrpOptional}`} htmlFor="edit-variant-mrp">
            <MoneyInput
              size="kit"
              id="edit-variant-mrp"
              value={draft.mrp}
              onChange={(mrp) => onPatch({ mrp })}
            />
          </KitField>
          <KitField label={pricing.cost} htmlFor="edit-variant-cost" help={pricing.costHelp}>
            <MoneyInput
              size="kit"
              id="edit-variant-cost"
              value={draft.cost}
              onChange={(cost) => onPatch({ cost })}
            />
          </KitField>
        </div>
        <ZeroPriceWarning variant={draft} />
        {profit ? (
          <p className="flex items-center gap-2 rounded-md border border-success/30 bg-success-soft px-3 py-2 text-body text-success">
            <TrendingUp className="size-4 shrink-0" aria-hidden="true" />
            {pricing.margin(`${profit.pct}%`, fmt.money(profit.profitPaise))}
          </p>
        ) : null}
      </Group>

      <Group title={copy.inventory}>
        <div className="grid gap-4 md:grid-cols-2">
          <KitField label={inventory.sku} htmlFor="edit-variant-sku">
            <div className="flex gap-2">
              <Input
                size="kit"
                id="edit-variant-sku"
                value={draft.sku}
                onChange={(e) => onPatch({ sku: e.target.value })}
                autoComplete="off"
              />
              <Button
                type="button"
                variant="outline"
                className="h-9 shrink-0"
                onClick={onGenerateSku}
                title={inventory.skuGenerateHelp}
              >
                {inventory.skuGenerate}
              </Button>
            </div>
          </KitField>
          <KitField label={inventory.barcode} htmlFor="edit-variant-barcode">
            <Input
              size="kit"
              id="edit-variant-barcode"
              value={draft.barcode}
              onChange={(e) => onPatch({ barcode: e.target.value })}
              autoComplete="off"
            />
          </KitField>
          <KitField label={inventory.quantity} htmlFor="edit-variant-quantity">
            {draft.trackInventory ? (
              <MoneyInput
                size="kit"
                id="edit-variant-quantity"
                currency={false}
                value={draft.quantity}
                onChange={(quantity) => onPatch({ quantity })}
              />
            ) : (
              <Input
                size="kit"
                id="edit-variant-quantity"
                value={inventory.unlimitedValue}
                readOnly
              />
            )}
          </KitField>
          <div className="flex items-start justify-between gap-4 md:pt-6">
            <div className="flex flex-col gap-0.5">
              <label htmlFor="edit-variant-track" className="text-body text-foreground">
                {copy.track}
              </label>
              <p className="text-caption text-muted-foreground">{copy.trackHelp}</p>
            </div>
            <Switch
              id="edit-variant-track"
              checked={draft.trackInventory}
              onCheckedChange={(trackInventory) => onPatch({ trackInventory })}
            />
          </div>
        </div>
      </Group>

      <Group title={copy.visibility}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <label htmlFor="edit-variant-hidden" className="text-body text-foreground">
              {copy.hide}
            </label>
            <p className="text-caption text-muted-foreground">{copy.hideHelp}</p>
          </div>
          <Switch
            id="edit-variant-hidden"
            checked={draft.hiddenOnStore}
            onCheckedChange={(hiddenOnStore) => onPatch({ hiddenOnStore })}
          />
        </div>
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <label htmlFor="edit-variant-preorder" className="text-body text-foreground">
              {copy.preorder}
            </label>
            <p className="text-caption text-muted-foreground">{copy.preorderHelp}</p>
          </div>
          <Switch
            id="edit-variant-preorder"
            checked={draft.preorderAllowed}
            onCheckedChange={(preorderAllowed) => onPatch({ preorderAllowed })}
          />
        </div>
        {preorder.on && draft.preorderAllowed ? (
          <KitField
            label={copy.preorderLimit}
            htmlFor="edit-variant-preorder-limit"
            help={copy.preorderLimitHelp}
          >
            <Input
              size="kit"
              id="edit-variant-preorder-limit"
              value={draft.preorderLimit}
              placeholder={limitPlaceholder}
              onChange={(e) => onPatch({ preorderLimit: e.target.value.replace(/\D/g, '') })}
              autoComplete="off"
              inputMode="numeric"
              className="md:max-w-[12rem]"
            />
          </KitField>
        ) : null}
      </Group>

      <Group title={copy.tax}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <label htmlFor="edit-variant-taxable" className="text-body text-foreground">
              {pricing.taxable}
            </label>
            <p className="text-caption text-muted-foreground">{pricing.taxableHelp}</p>
          </div>
          <Switch
            id="edit-variant-taxable"
            checked={draft.taxable}
            onCheckedChange={(taxable) => onPatch({ taxable })}
          />
        </div>
        {tax.perVariant ? (
          <div className="grid gap-4 md:grid-cols-2">
            {draft.taxable ? (
              <KitField
                label={shipping.gstRate}
                htmlFor="edit-variant-gst"
                help={shipping.gstRateHelp}
              >
                <Input
                  size="kit"
                  id="edit-variant-gst"
                  value={draft.gstRate}
                  placeholder={
                    tax.gstRate.trim() ? copy.fromProduct(tax.gstRate.trim()) : undefined
                  }
                  onChange={(e) =>
                    onPatch({ gstRate: e.target.value.replace(/\D/g, '').slice(0, 2) })
                  }
                  autoComplete="off"
                  inputMode="numeric"
                />
              </KitField>
            ) : null}
            <KitField label={shipping.hsCode} htmlFor="edit-variant-hs" help={shipping.hsCodeHelp}>
              <Input
                size="kit"
                id="edit-variant-hs"
                value={draft.hsCode}
                placeholder={tax.hsCode.trim() ? copy.fromProduct(tax.hsCode.trim()) : undefined}
                onChange={(e) => onPatch({ hsCode: e.target.value })}
                autoComplete="off"
                inputMode="numeric"
              />
            </KitField>
          </div>
        ) : (
          <p className="text-caption text-muted-foreground">{copy.taxFromProduct}</p>
        )}
      </Group>

      <Group title={copy.shipping}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <label htmlFor="edit-variant-physical" className="text-body text-foreground">
              {physical.physical}
            </label>
            <p className="text-caption text-muted-foreground">{physical.physicalHelp}</p>
          </div>
          <Switch
            id="edit-variant-physical"
            checked={draft.requiresShipping}
            onCheckedChange={(requiresShipping) => onPatch({ requiresShipping })}
          />
        </div>
        {draft.requiresShipping ? (
          <KitField
            label={shipping.weight}
            htmlFor="edit-variant-weight"
            help={shipping.weightHelp}
          >
            <WeightInput
              id="edit-variant-weight"
              weight={draft.weight}
              unit={draft.weightUnit}
              onChange={onPatch}
            />
          </KitField>
        ) : null}
        {draft.requiresShipping ? (
          <VariantBoxField draft={draft} productBox={productBox} onPatch={onPatch} />
        ) : null}
        <div className="grid gap-4 md:grid-cols-2">
          <KitField label={shipping.country} htmlFor="edit-variant-origin">
            <Select
              items={countries}
              value={draft.countryOfOrigin || NONE}
              onValueChange={(next) =>
                onPatch({ countryOfOrigin: next === NONE ? '' : String(next) })
              }
            >
              <SelectTrigger size="lg" id="edit-variant-origin" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{shipping.countryPlaceholder}</SelectItem>
                {COUNTRIES.map((country) => (
                  <SelectItem key={country.code} value={country.code}>
                    {country.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </KitField>
        </div>
      </Group>
    </div>
  )
}

/** A titled group inside the variant dialog. */
function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-4">
      <h3 className="text-eyebrow text-muted-foreground">{title}</h3>
      {children}
    </section>
  )
}
