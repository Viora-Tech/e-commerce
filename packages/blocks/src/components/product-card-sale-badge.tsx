'use client'

import { hasFixedPrice, lowestPresentment } from '@commerce/money'
import { useMarketPricing } from '../money-format'

const saleLabel = (percent: number) => `−${percent}%`

type ProductCardSaleBadgeProps = {
  pricePaise: number | null
  mrpPaise: number | null
  variantId?: string | null | undefined
  variants?: readonly { id: string; pricePaise: number }[] | undefined
}

/**
 * The card's "−N%" badge, by the same rule as the price line under it (`Price`): a fixed catalog
 * price has no MRP beside it, so it has no saving either, and a market's own conversion keeps
 * the percentage, so rupees give the right number everywhere else.
 */
export default function ProductCardSaleBadge({
  pricePaise,
  mrpPaise,
  variantId,
  variants,
}: ProductCardSaleBadgeProps) {
  // Hooks
  const pricing = useMarketPricing()

  // Early returns
  if (pricePaise == null || !mrpPaise || mrpPaise <= pricePaise) return null

  // Render logic
  const lowest = variants ? lowestPresentment(variants, pricing) : null
  const shownId = lowest?.id ?? variantId ?? undefined
  const shownPaise = lowest?.pricePaise ?? pricePaise
  if ((shownId !== undefined && hasFixedPrice(pricing, shownId)) || shownPaise !== pricePaise) {
    return null
  }
  const percent = Math.round(((mrpPaise - pricePaise) / mrpPaise) * 100)

  return (
    <span className="badge badge--sale product-card__badge product-card__badge--sale">
      {saleLabel(percent)}
    </span>
  )
}
