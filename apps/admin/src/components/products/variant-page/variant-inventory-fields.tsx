'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import Link from 'next/link'
import MoneyInput from '@/components/fields/money-input'
import KitField from '@/components/kit/kit-field'
import { productFormContent } from '@/data/product-form'
import { variantPageContent } from '@/data/variant-page'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'
import type { VariantRow } from '../form-state'
import type { VariantPreorderContext } from '../variant-preorder-limit'
import SwitchRow from './switch-row'

type VariantInventoryFieldsProps = {
  productId: string
  draft: VariantRow
  onPatch: (patch: Partial<VariantRow>) => void
  /** Fills the SKU from the product and this variant's option values. */
  onGenerateSku: () => void
  /** Whether the product takes pre-orders and the limit a blank field uses (#1536). */
  preorder: VariantPreorderContext
}

/**
 * The variant page's Inventory card: SKU, barcode, stock at the default location (every location
 * in the bulk editor), whether stock is counted, and pre-order with the variant's own limit.
 */
export default function VariantInventoryFields({
  productId,
  draft,
  onPatch,
  onGenerateSku,
  preorder,
}: VariantInventoryFieldsProps) {
  // Hooks
  const { inventory } = useCopy(productFormContent)
  const pageCopy = useCopy(variantPageContent)
  const fmt = useFormat()

  // Render logic
  const copy = pageCopy.fields
  const { inherited } = preorder
  const limitPlaceholder =
    inherited.from === 'campaign'
      ? copy.preorderLimitFromCampaign
      : inherited.limit == null
        ? copy.preorderLimitNone
        : copy.preorderLimitFromProduct(fmt.number(inherited.limit))

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <KitField label={inventory.sku} htmlFor="variant-sku">
          <div className="flex gap-2">
            <Input
              size="kit"
              id="variant-sku"
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
        <KitField label={inventory.barcode} htmlFor="variant-barcode">
          <Input
            size="kit"
            id="variant-barcode"
            value={draft.barcode}
            onChange={(e) => onPatch({ barcode: e.target.value })}
            autoComplete="off"
          />
        </KitField>
      </div>
      <SwitchRow
        id="variant-track"
        label={copy.track}
        help={copy.trackHelp}
        checked={draft.trackInventory}
        onChange={(trackInventory) => onPatch({ trackInventory })}
      />
      <div className="flex flex-wrap items-end gap-4">
        <KitField
          label={inventory.quantity}
          htmlFor="variant-quantity"
          className="md:max-w-[12rem]"
        >
          {draft.trackInventory ? (
            <MoneyInput
              size="kit"
              id="variant-quantity"
              currency={false}
              value={draft.quantity}
              onChange={(quantity) => onPatch({ quantity })}
            />
          ) : (
            <Input size="kit" id="variant-quantity" value={inventory.unlimitedValue} readOnly />
          )}
        </KitField>
        {draft.trackInventory ? (
          <Button
            variant="link"
            className="h-9 px-0"
            nativeButton={false}
            render={<Link href={routes.products.bulkEdit([productId], { reason: 'correction' })} />}
          >
            {pageCopy.inventory.byLocation}
          </Button>
        ) : null}
      </div>
      <SwitchRow
        id="variant-preorder"
        label={copy.preorder}
        help={copy.preorderHelp}
        checked={draft.preorderAllowed}
        onChange={(preorderAllowed) => onPatch({ preorderAllowed })}
      />
      {preorder.on && draft.preorderAllowed ? (
        <KitField
          label={copy.preorderLimit}
          htmlFor="variant-preorder-limit"
          help={copy.preorderLimitHelp}
        >
          <Input
            size="kit"
            id="variant-preorder-limit"
            value={draft.preorderLimit}
            placeholder={limitPlaceholder}
            onChange={(e) => onPatch({ preorderLimit: e.target.value.replace(/\D/g, '') })}
            autoComplete="off"
            inputMode="numeric"
            className="md:max-w-[12rem]"
          />
        </KitField>
      ) : null}
    </div>
  )
}
