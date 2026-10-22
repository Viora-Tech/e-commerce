'use client'

import type { ProductFormState } from './form-state'
import SearchConsoleCard from './search-console-card'
import SeoCard from './seo-card'
import SeoKeywordsCard from './seo-keywords-card'

type ProductSeoPanelProps = {
  form: ProductFormState
  /** Null while the product is unsaved. */
  productId: string | null
  storefrontOrigin: string
  aiWriter: boolean
  onPatch: (p: Partial<ProductFormState>) => void
}

/** The product's Search tab: Google and social share previews, keywords, and Search Console. */
export default function ProductSeoPanel({
  form,
  productId,
  storefrontOrigin,
  aiWriter,
  onPatch,
}: ProductSeoPanelProps) {
  // Render logic
  const image = form.media.find((m) => !m.contentType?.startsWith('video/')) ?? null

  return (
    <>
      <SeoCard
        title={form.title}
        description={form.description}
        seoTitle={form.seoTitle}
        seoDescription={form.seoDescription}
        handle={form.handle}
        storefrontOrigin={storefrontOrigin}
        image={image}
        onSeoTitle={(seoTitle) => onPatch({ seoTitle })}
        onSeoDescription={(seoDescription) => onPatch({ seoDescription })}
        onHandle={(handle) => onPatch({ handle })}
      />
      <SeoKeywordsCard
        productId={productId}
        form={form}
        aiOn={aiWriter}
        onChange={(seoKeywords) => onPatch({ seoKeywords })}
      />
      {productId ? <SearchConsoleCard productId={productId} /> : null}
    </>
  )
}
