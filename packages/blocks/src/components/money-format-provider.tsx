'use client'

import type { MarketPricing } from '@commerce/money'
import type { ReactNode } from 'react'
import { MarketPricingContext, MoneyFormatContext } from '../money-format'

type MoneyFormatProviderProps = {
  /** The store's price format (`Rs. {{amount}}`); null keeps the currency's own. */
  format: string | null
  /** The page's market when it shows another currency; null shows rupees. */
  pricing?: MarketPricing | null | undefined
  children: ReactNode
}

/** Wraps the storefront so every price block reads the store's price format and market. */
export default function MoneyFormatProvider({
  format,
  pricing = null,
  children,
}: MoneyFormatProviderProps) {
  return (
    <MoneyFormatContext value={format}>
      <MarketPricingContext value={pricing}>{children}</MarketPricingContext>
    </MoneyFormatContext>
  )
}
