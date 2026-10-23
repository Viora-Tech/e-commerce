/**
 * Sections installed apps add to a product's More tab, keyed by plugin id. Kept out of
 * `./registry` so the product page does not bundle every app's admin pages. An app missing
 * here adds no section.
 */
import type { ComponentType } from 'react'
import BackInStockSection from '@/components/apps/back-in-stock/product-section'
import GstSection from '@/components/apps/gst-invoices/product-section'
import ReviewsSection from '@/components/apps/reviews/product-section'
import AutomationsSection from '@/components/automations/records/product-section'

/** One saved variant, as an app section reads it. */
export type ProductSectionVariant = { id: string; label: string; hsCode: string; gstRate: string }

export type ProductSectionProps = {
  productId: string
  variants: readonly ProductSectionVariant[]
  /** Opens a tab of the product page and focuses the field with this id. */
  onOpenTab: (tab: 'shipping' | 'seo' | 'more', focus?: string) => void
}

export const PRODUCT_APP_SECTIONS: Record<string, ComponentType<ProductSectionProps>> = {
  reviews: ReviewsSection,
  'back-in-stock': BackInStockSection,
  'gst-invoices': GstSection,
  automations: AutomationsSection,
}
