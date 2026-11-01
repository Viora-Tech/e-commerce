'use client'

import type { InventoryReason } from '@commerce/core/catalog'
import type { RichTextValue } from '@commerce/richtext'
import type { ReactNode } from 'react'
import DataCard from '@/components/layout/data-card'
import { productFormContent } from '@/data/product-form'
import { useCopy } from '@/hooks/use-copy'
import type { Facets, ProductFormState, VariantRow } from './form-state'
import ProductBasicsSection from './product-basics-section'
import ProductPricingSection from './product-pricing-section'
import ProductStockSection from './product-stock-section'

type ProductMainCardProps = {
  form: ProductFormState
  variant: VariantRow
  /** Store GST defaults for the pricing card's breakdown. */
  facets?: Facets | undefined
  /** Which card this renders; the form puts each one in its own tab. */
  tab: 'details' | 'pricing' | 'inventory'
  titleError?: string | undefined
  quantityChanged: boolean
  onPatch: (patch: Partial<ProductFormState>) => void
  onVariant: (patch: Partial<VariantRow>) => void
  onReason: (reason: InventoryReason) => void
  /** Right side of the details card header ("Write with AI" when AI is on). */
  detailsAction?: ReactNode
}

/**
 * One card of the product page's Details, Pricing or Inventory tab, after the Saleor Dashboard
 * product page (BSD-3). Pre-order lives in the "More" tab (`product-form.tsx`).
 */
export default function ProductMainCard({
  form,
  variant,
  facets,
  tab,
  titleError,
  quantityChanged,
  onPatch,
  onVariant,
  onReason,
  detailsAction,
}: ProductMainCardProps) {
  // Hooks
  const copy = useCopy(productFormContent)

  // Event handlers
  const handleDescription = (description: RichTextValue) => onPatch({ description })

  // Render logic
  if (tab === 'details') {
    return (
      <DataCard title={copy.basics} action={detailsAction}>
        <ProductBasicsSection
          title={form.title}
          description={form.description}
          titleError={titleError}
          onTitle={(title) => onPatch({ title })}
          onDescription={handleDescription}
        />
      </DataCard>
    )
  }
  if (tab === 'pricing') {
    return (
      <DataCard title={copy.pricing.heading}>
        <ProductPricingSection
          variant={variant}
          gst={facets?.gst}
          taxIncluded={form.taxIncluded}
          saleStartsAt={form.saleStartsAt}
          saleEndsAt={form.saleEndsAt}
          tax={form.tax}
          onTax={(tax) => onPatch({ tax })}
          onVariant={onVariant}
          onTaxIncluded={(taxIncluded) => onPatch({ taxIncluded })}
          onSaleStartsAt={(saleStartsAt) => onPatch({ saleStartsAt })}
          onSaleEndsAt={(saleEndsAt) => onPatch({ saleEndsAt })}
        />
      </DataCard>
    )
  }
  return (
    <DataCard title={copy.inventory.heading}>
      <ProductStockSection
        variant={variant}
        skuStem={form.handle || form.title}
        otherSkus={form.variants.filter((v) => v !== variant).map((v) => v.sku)}
        lowStockThreshold={facets?.lowStockThreshold}
        featured={form.featured}
        quantityChanged={quantityChanged}
        reason={form.inventoryReason}
        onVariant={onVariant}
        onFeatured={(featured) => onPatch({ featured })}
        onReason={onReason}
      />
    </DataCard>
  )
}
