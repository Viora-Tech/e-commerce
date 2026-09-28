'use client'

import type { InventoryReason } from '@commerce/core/catalog'
import type { RichTextValue } from '@commerce/richtext'
import type { ReactNode } from 'react'
import DataCard from '@/components/layout/data-card'
import { productFormContent } from '@/data/products'
import { useCopy } from '@/hooks/use-copy'
import type { ProductFormState, VariantRow } from './form-state'
import ProductBasicsSection from './product-basics-section'
import ProductPricingSection from './product-pricing-section'
import ProductStockSection from './product-stock-section'

type ProductMainCardProps = {
  form: ProductFormState
  variant: VariantRow
  /** Pricing and stock live in the variants table once options exist. */
  singleVariant: boolean
  titleError?: string | undefined
  quantityChanged: boolean
  onPatch: (patch: Partial<ProductFormState>) => void
  onVariant: (patch: Partial<VariantRow>) => void
  onReason: (reason: InventoryReason) => void
  /** The media card, drawn first so the jump nav reads top to bottom: Media, Details, Pricing, Inventory. */
  media?: ReactNode
}

/** Jump-nav targets land below the sticky page header instead of under it. */
const SECTION = 'scroll-mt-[calc(var(--detail-header-height,11rem)+1rem)]'

/**
 * The product page main column head, after the Saleor Dashboard product page (BSD-3):
 * media, general information, then pricing and inventory as their own cards. Each
 * section carries an id so the compact jump nav (`ProductSectionNav`) can scroll to it;
 * pre-order moved out to the "More" group (`ProductMoreSection`, in `product-form.tsx`).
 */
export default function ProductMainCard({
  form,
  variant,
  singleVariant,
  titleError,
  quantityChanged,
  onPatch,
  onVariant,
  onReason,
  media,
}: ProductMainCardProps) {
  // Hooks
  const copy = useCopy(productFormContent)

  // Event handlers
  const handleDescription = (description: RichTextValue) => onPatch({ description })

  // Render logic
  return (
    <>
      <section id="media" className={SECTION}>
        {media}
      </section>
      <section id="details" className={SECTION}>
        <DataCard title={copy.basics}>
          <ProductBasicsSection
            title={form.title}
            description={form.description}
            titleError={titleError}
            onTitle={(title) => onPatch({ title })}
            onDescription={handleDescription}
          />
        </DataCard>
      </section>
      {singleVariant ? (
        <>
          <section id="pricing" className={SECTION}>
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
          </section>
          <section id="inventory" className={SECTION}>
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
          </section>
        </>
      ) : null}
    </>
  )
}
