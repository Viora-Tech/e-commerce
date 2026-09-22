'use client'

import type { InventoryReason } from '@commerce/core/catalog'
import type { RichTextValue } from '@commerce/richtext'
import { Save } from '@commerce/ui/icons'
import { Card, CardContent } from '@commerce/ui/shadcn/card'
import KitButton from '@/components/kit/kit-button'
import { productFormContent } from '@/data/products'
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
  busy: boolean
  onPatch: (patch: Partial<ProductFormState>) => void
  onVariant: (patch: Partial<VariantRow>) => void
  onReason: (reason: InventoryReason) => void
  onPublish: () => void
  onSaveDraft: () => void
}

const copy = productFormContent

/** Frame 5:5114: one card holding basic details, pricing and inventory, with the two save buttons at its foot. */
export default function ProductMainCard({
  form,
  variant,
  singleVariant,
  titleError,
  quantityChanged,
  busy,
  onPatch,
  onVariant,
  onReason,
  onPublish,
  onSaveDraft,
}: ProductMainCardProps) {
  // Event handlers
  const handleDescription = (description: RichTextValue) => onPatch({ description })

  // Render logic
  return (
    <Card size="form" className="gap-8 p-6">
      <CardContent className="flex flex-col gap-8 p-0">
        <section className="flex flex-col gap-6">
          <h2 className="text-kit-heading text-foreground">{copy.basics}</h2>
          <ProductBasicsSection
            title={form.title}
            description={form.description}
            titleError={titleError}
            onTitle={(title) => onPatch({ title })}
            onDescription={handleDescription}
          />
        </section>

        {singleVariant ? (
          <>
            <section className="flex flex-col gap-6">
              <h2 className="text-kit-heading text-foreground">{copy.pricing.heading}</h2>
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
            </section>
            <section className="flex flex-col gap-6">
              <h2 className="text-kit-heading text-foreground">{copy.inventory.heading}</h2>
              <ProductStockSection
                variant={variant}
                featured={form.featured}
                quantityChanged={quantityChanged}
                reason={form.inventoryReason}
                onVariant={onVariant}
                onFeatured={(featured) => onPatch({ featured })}
                onReason={onReason}
              />
            </section>
          </>
        ) : null}

        <div className="flex flex-wrap justify-end gap-3">
          <KitButton variant="secondary" onClick={onSaveDraft} disabled={busy}>
            <Save className="size-4" aria-hidden="true" />
            {copy.saveDraft}
          </KitButton>
          <KitButton variant="primary" onClick={onPublish} disabled={busy}>
            {copy.publish}
          </KitButton>
        </div>
      </CardContent>
    </Card>
  )
}
