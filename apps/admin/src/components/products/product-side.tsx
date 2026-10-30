'use client'

import PageChecklist, { type ChecklistItem } from '@/components/layout/page-checklist'
import TemplateSelectCard from '@/components/themes/template-select-card'
import { productFormContent } from '@/data/product-form'
import { useCopy } from '@/hooks/use-copy'
import type { Facets, OptionRow, ProductFormState } from './form-state'
import ProductCategoriesCard from './product-categories-card'
import ProductCollectionsCard from './product-collections-card'
import ProductPageActions from './product-page-actions'
import StatusCard from './status-card'

type ProductSideProps = {
  form: ProductFormState
  facets: Facets
  /** Null while the product is unsaved. */
  productId: string | null
  /** Bumped after each save so the collections card refetches. */
  revision: number
  checklist: ChecklistItem[]
  activeTab: string
  busy: boolean
  live: boolean
  onPatch: (p: Partial<ProductFormState>) => void
  onSelectTab: (id: string) => void
  onPublish: () => void
  onSaveDraft: () => void
}

/** Values of the colour option, for the swatch row on the categories card. */
function colourValues(options: OptionRow[]): string[] {
  const option = options.find((o) => /colou?r/i.test(o.name))
  return option ? option.values.filter((v) => v.trim()) : []
}

/**
 * The product page's right column, Shopify's order: what is left to do, status, organisation,
 * collections and the theme template, then the save buttons.
 */
export default function ProductSide({
  form,
  facets,
  productId,
  revision,
  checklist,
  activeTab,
  busy,
  live,
  onPatch,
  onSelectTab,
  onPublish,
  onSaveDraft,
}: ProductSideProps) {
  // Hooks
  const copy = useCopy(productFormContent)

  // Render logic
  const toFix = checklist.filter((item) => item.state === 'warn').length

  return (
    <>
      <PageChecklist
        heading={copy.checklist.heading}
        summary={copy.checklist.toFix(toFix)}
        items={checklist}
        active={activeTab}
        onSelect={onSelectTab}
      />
      <StatusCard
        status={form.status}
        vendor={form.vendor}
        facets={facets}
        onChange={(status) => onPatch({ status })}
        onVendor={(vendor) => onPatch({ vendor })}
      />
      <ProductCategoriesCard
        categoryId={form.categoryId}
        productType={form.productType}
        tags={form.tags}
        colours={colourValues(form.options)}
        facets={facets}
        onCategoryId={(categoryId) => onPatch({ categoryId })}
        onProductType={(productType) => onPatch({ productType })}
        onTags={(tags) => onPatch({ tags })}
      />
      <ProductCollectionsCard productId={productId} revision={revision} />
      <TemplateSelectCard
        kind="product"
        value={form.templateSuffix}
        onChange={(templateSuffix) => onPatch({ templateSuffix })}
      />
      {/* A saved product saves from the header and the save bar; a second pair of buttons down
          here made two places to save (audit #58). A new one keeps Save to draft / Publish. */}
      {productId ? null : (
        <div className="flex flex-wrap justify-end gap-2">
          <ProductPageActions
            busy={busy}
            live={live}
            onPublish={onPublish}
            onSaveDraft={onSaveDraft}
          />
        </div>
      )}
    </>
  )
}
