'use client'

import type { InventoryReason } from '@commerce/core/catalog'
import type { RichTextValue } from '@commerce/richtext'
import type { ReactNode } from 'react'
import DataCard from '@/components/layout/data-card'
import { productFormContent } from '@/data/products'
import type { ProductFormState, VariantRow } from './form-state'
import ProductBasicsSection from './product-basics-section'
import ProductPreorderSection from './product-preorder-section'
import ProductPricingSection from './product-pricing-section'
import ProductStockSection from './product-stock-section'

type ProductMainCardProps = {
  form: ProductFormState
  variant: VariantRow
  /** Pricing and stock live in the variants table once options exist. */
  singleVariant: boolean
  titleError?: string | undefined
  quantityChanged: boolean
  preorderDepositError?: string | undefined
  onPatch: (patch: Partial<ProductFormState>) => void
  onVariant: (patch: Partial<VariantRow>) => void
  onReason: (reason: InventoryReason) => void
  /** The media card, drawn right under general information (Saleor product page order). */
  media?: ReactNode
}

const copy = productFormContent

/**
 * The product page main column head, after the Saleor Dashboard product page (BSD-3):
 * general information, media, then pricing and inventory as their own cards.
 */
export default function ProductMainCard({
  form,
  variant,
  singleVariant,
  titleError,
  quantityChanged,
  preorderDepositError,
  onPatch,
  onVariant,
  onReason,
  media,
}: ProductMainCardProps) {
  // Event handlers
  const handleDescription = (description: RichTextValue) => onPatch({ description })

  // Render logic
  return (
    <>
      <DataCard title={copy.basics}>
        <ProductBasicsSection
          title={form.title}
          description={form.description}
          titleError={titleError}
          onTitle={(title) => onPatch({ title })}
          onDescription={handleDescription}
        />
      </DataCard>
      {media}
      {singleVariant ? (
        <>
          <DataCard title={copy.pricing.heading}>
            <ProductPricingSection
              variant={variant}
              taxIncluded={form.taxIncluded}
              saleStartsAt={form.saleStartsAt}
              saleEndsAt={form.saleEndsAt}
              onVariant={onVariant}
              onTaxIncluded={(taxIncluded) => onPatch({ taxIncluded })}
              onSaleStartsAt={(saleStartsAt) => onPatch({ saleStartsAt })}
              onSaleEndsAt={(saleEndsAt) => onPatch({ saleEndsAt })}
            />
          </DataCard>
          <DataCard title={copy.inventory.heading}>
            <ProductStockSection
              variant={variant}
              featured={form.featured}
              quantityChanged={quantityChanged}
              reason={form.inventoryReason}
              onVariant={onVariant}
              onFeatured={(featured) => onPatch({ featured })}
              onReason={onReason}
            />
          </DataCard>
        </>
      ) : null}
      <DataCard title={copy.preorder.heading}>
        <ProductPreorderSection form={form} depositError={preorderDepositError} onPatch={onPatch} />
      </DataCard>
    </>
  )
}
