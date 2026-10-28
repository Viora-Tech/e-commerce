import 'server-only'
import { type MarketPricing, presentmentCents, storeMarketPricing } from '@commerce/core'
import { headers } from 'next/headers'
import { MARKET_HEADERS } from './markets'
import { cachedForStore } from './store-cache'
import { inStore } from './store-context'

/** The UTC day: reference rates change once a day, so a day's pricing is read once. */
const rateDay = (): string => new Date().toISOString().slice(0, 10)

/**
 * How the market `marketId` prices, when it shows another currency than the store's rupees;
 * null for the store's own market, a store without markets, or a market with no rate yet.
 * Read for every market at once and cached per store version and day.
 */
export async function marketPricingFor(
  storeId: string,
  marketId: string | null | undefined,
): Promise<MarketPricing | null> {
  if (!marketId) return null
  const all = await cachedForStore(storeId, `market-pricing|${rateDay()}`, () =>
    inStore(storeId, (tx) => storeMarketPricing(tx)),
  )
  const p = all.get(marketId) ?? null
  return p && !(p.currency === 'INR' && p.adjustmentBp === 0) ? p : null
}

/** This request's market pricing, from the proxy's market header. */
export async function requestMarketPricing(storeId: string): Promise<MarketPricing | null> {
  return marketPricingFor(storeId, (await headers()).get(MARKET_HEADERS.id))
}

/** What a cache keys a market's prices by: '' for rupees, else its currency and rate. */
export function pricingKey(p: MarketPricing | null): string {
  return p ? `${p.currency}@${p.rate}@${p.adjustmentBp}@${p.rounding}` : ''
}

/** Paise as this request's market shows money to an imported theme: hundredths of its currency. */
export async function requestPriceCents(storeId: string, paise: number): Promise<number> {
  return presentmentCents(paise, await requestMarketPricing(storeId))
}
