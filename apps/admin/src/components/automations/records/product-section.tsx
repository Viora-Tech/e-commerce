'use client'

import type { ProductSectionProps } from '@/apps/product-sections'
import AutomationHistoryCard from './automation-history-card'

/** The Automations app's section in a product's More tab: "Automations on this product". */
export default function ProductSection({ productId }: ProductSectionProps) {
  // Render logic
  return <AutomationHistoryCard type="product" id={productId} />
}
