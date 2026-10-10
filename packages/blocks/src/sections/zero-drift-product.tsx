import type { ComponentConfig } from '@puckeditor/core'
import { type ProductFeaturesProps, productFeaturesSection } from './zero-drift/product-features'
import { type ProductReviewsProps, productReviewsSection } from './zero-drift/product-reviews'
import {
  type ProductSizeGuideProps,
  productSizeGuideSection,
} from './zero-drift/product-size-guide'
import {
  type ProductSizeTableProps,
  productSizeTableSection,
} from './zero-drift/product-size-table'
import {
  type ProductSpecStripProps,
  productSpecStripSection,
} from './zero-drift/product-spec-strip'
import { type ProductSpecsProps, productSpecsSection } from './zero-drift/product-specs'
import { type ProductTabsProps, productTabsSection } from './zero-drift/product-tabs'
import { type StickyAtcProps, stickyAtcSection } from './zero-drift/sticky-atc'

/**
 * SOURCE OF TRUTH KEYWORDS: zeroDriftProductSections, ZeroDriftProductProps, ZERO_DRIFT_PRODUCT_SECTIONS
 * WHAT:  The Zero Drift theme's product-page sections below the main product (tabs, spec groups,
 *        spec strip, features, size guide, size table, reviews), in templates/product.json's order.
 * WHY:   They read the product being viewed (`SectionMetadata.product`), so they live apart
 *        from the home-page `ZERO_DRIFT_SECTIONS` and sit in the Add panel's Products category.
 *        Their per-product data (spec rows, sizes, the table) is plain text a merchant types
 *        or connects to a multi-line product metafield (dynamic sources).
 * WHERE: `../puck-config.tsx` registers them; configs in `./zero-drift/product-*.tsx`, the shared
 *        product gate in `./zero-drift/product-frame.tsx`, row formats in `../product-data.ts`.
 */
export type ZeroDriftProductProps = {
  ProductSpecs: ProductSpecsProps
  ProductSizeGuide: ProductSizeGuideProps
  ProductSizeTable: ProductSizeTableProps
  ProductTabs: ProductTabsProps
  ProductSpecStrip: ProductSpecStripProps
  ProductFeatures: ProductFeaturesProps
  ProductReviews: ProductReviewsProps
  StickyAtc: StickyAtcProps
}

const BUILDERS: { [K in keyof ZeroDriftProductProps]: () => ComponentConfig } = {
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
export const ZERO_DRIFT_PRODUCT_SECTIONS = Object.keys(BUILDERS) as (keyof ZeroDriftProductProps)[]

export function zeroDriftProductSections(): Record<keyof ZeroDriftProductProps, ComponentConfig> {
  return Object.fromEntries(ZERO_DRIFT_PRODUCT_SECTIONS.map((k) => [k, BUILDERS[k]()])) as Record<
    keyof ZeroDriftProductProps,
    ComponentConfig
  >
}
