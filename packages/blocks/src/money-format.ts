'use client'

import {
  formatPresentment,
  formatPresentmentCart,
  formatPresentmentLine,
  formatPresentmentSaving,
  formatStoreMoney,
  type MarketPricing,
  type PresentmentLine,
} from '@commerce/money'
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

/**
 * Formats a sale's saving the way this page shows prices: in a market, the difference of the
 * two converted prices, so it always matches them (#57); else the store's own format.
 */
export function useFormatSaving(): (mrpPaise: number, pricePaise: number) => string {
  const format = use(MoneyFormatContext)
  const pricing = use(MarketPricingContext)
  return (mrpPaise, pricePaise) =>
    pricing
      ? formatPresentmentSaving(mrpPaise, pricePaise, pricing)
      : formatStoreMoney(mrpPaise - pricePaise, format)
}

/**
 * Formats cart amounts the way this page shows prices (Markets › Catalogs): `line` is a cart
 * line's total (a fixed unit price × quantity where the market's catalog has one), `cart` an
 * amount built on the subtotal (subtotal, total, to pay) that agrees with those lines.
 */
export function useFormatCart(): {
  line: (line: PresentmentLine) => string
  cart: (paise: number, lines: readonly PresentmentLine[], subtotalPaise: number) => string
} {
  const format = use(MoneyFormatContext)
  const pricing = use(MarketPricingContext)
  return {
    line: (l) =>
      pricing ? formatPresentmentLine(l, pricing) : formatStoreMoney(l.linePaise, format),
    cart: (paise, lines, subtotalPaise) =>
      pricing
        ? formatPresentmentCart(paise, lines, subtotalPaise, pricing)
        : formatStoreMoney(paise, format),
  }
}

/** The page's market pricing when it shows another currency; null for rupees. */
export function useMarketPricing(): MarketPricing | null {
  return use(MarketPricingContext)
}
