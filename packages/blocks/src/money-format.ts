'use client'

import { formatPresentment, formatStoreMoney, type MarketPricing } from '@commerce/money'
import { createContext, use } from 'react'

/**
 * The store's price format (Settings › Store details, or the shop's own from the Shopify
 * import), e.g. `Rs. {{amount}}`. Null, and the admin canvas, show the currency's format.
 */
export const MoneyFormatContext = createContext<string | null>(null)

/**
 * The page's market when it shows another currency than rupees (Settings → Markets): every
 * price converts with its rate, adjustment and rounding. Null shows rupees.
 */
export const MarketPricingContext = createContext<MarketPricing | null>(null)

/**
 * Formats paise the way this page shows prices: in the market's currency (`AED 23.50`), else
 * the store's own format ("Rs. 6,499.00" or "₹6,499"). With `variantId`, one unit of that
 * variant: its catalog's fixed price wins (Markets › Catalogs).
 */
export function useFormatPaise(): (paise: number, variantId?: string) => string {
  const format = use(MoneyFormatContext)
  const pricing = use(MarketPricingContext)
  return (paise, variantId) =>
    pricing ? formatPresentment(paise, pricing, variantId) : formatStoreMoney(paise, format)
}

/** The page's market pricing when it shows another currency; null for rupees. */
export function useMarketPricing(): MarketPricing | null {
  return use(MarketPricingContext)
}
