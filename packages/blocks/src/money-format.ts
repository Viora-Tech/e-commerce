'use client'

import { formatStoreMoney } from '@commerce/money'
import { createContext, use } from 'react'

/**
 * The store's price format (Settings › Store details, or the shop's own from the Shopify
 * import), e.g. `Rs. {{amount}}`. Null, and the admin canvas, show the currency's format.
 */
export const MoneyFormatContext = createContext<string | null>(null)

/** Formats paise the way this store shows prices ("Rs. 6,499.00" or "₹6,499"). */
export function useFormatPaise(): (paise: number) => string {
  const format = use(MoneyFormatContext)
  return (paise) => formatStoreMoney(paise, format)
}
