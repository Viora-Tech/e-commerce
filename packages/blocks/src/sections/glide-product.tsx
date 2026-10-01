import type { ComponentConfig } from '@puckeditor/core'
import { type ProductFeaturesProps, productFeaturesSection } from './glide/product-features'
import { type ProductReviewsProps, productReviewsSection } from './glide/product-reviews'
import { type ProductSizeGuideProps, productSizeGuideSection } from './glide/product-size-guide'
import { type ProductSizeTableProps, productSizeTableSection } from './glide/product-size-table'
import { type ProductSpecStripProps, productSpecStripSection } from './glide/product-spec-strip'
import { type ProductSpecsProps, productSpecsSection } from './glide/product-specs'
import { type ProductTabsProps, productTabsSection } from './glide/product-tabs'
import { type StickyAtcProps, stickyAtcSection } from './glide/sticky-atc'

/**
 * SOURCE OF TRUTH KEYWORDS: glideProductSections, GlideProductProps, GLIDE_PRODUCT_SECTIONS
 * WHAT:  The Zero Drift theme's product-page sections below the main product (tabs, spec groups,
 *        spec strip, features, size guide, size table, reviews), in templates/product.json's order.
 * WHY:   They read the product being viewed (`SectionMetadata.product`), so they live apart
 *        from the home-page `GLIDE_SECTIONS` and sit in the Add panel's Products category.
 *        Their per-product data (spec rows, sizes, the table) is plain text a merchant types
 *        or connects to a multi-line product metafield (dynamic sources).
 * WHERE: `../puck-config.tsx` registers them; configs in `./glide/product-*.tsx`, the shared
 *        product gate in `./glide/product-frame.tsx`, row formats in `../product-data.ts`.
 */
export type GlideProductProps = {
  ProductSpecs: ProductSpecsProps
  ProductSizeGuide: ProductSizeGuideProps
  ProductSizeTable: ProductSizeTableProps
  ProductTabs: ProductTabsProps
  ProductSpecStrip: ProductSpecStripProps
  ProductFeatures: ProductFeaturesProps
  ProductReviews: ProductReviewsProps
  StickyAtc: StickyAtcProps
}

const BUILDERS: { [K in keyof GlideProductProps]: () => ComponentConfig } = {
  ProductSpecs: productSpecsSection,
  ProductSizeGuide: productSizeGuideSection,
  ProductSizeTable: productSizeTableSection,
  ProductTabs: productTabsSection,
  ProductSpecStrip: productSpecStripSection,
  ProductFeatures: productFeaturesSection,
  ProductReviews: productReviewsSection,
  StickyAtc: stickyAtcSection,
}

/** Every Zero Drift product-page section key, in the theme product template's order. */
export const GLIDE_PRODUCT_SECTIONS = Object.keys(BUILDERS) as (keyof GlideProductProps)[]

export function glideProductSections(): Record<keyof GlideProductProps, ComponentConfig> {
  return Object.fromEntries(GLIDE_PRODUCT_SECTIONS.map((k) => [k, BUILDERS[k]()])) as Record<
    keyof GlideProductProps,
    ComponentConfig
  >
}
