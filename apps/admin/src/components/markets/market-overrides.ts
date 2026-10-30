import type { MarketView } from '@commerce/core'

/** A setting a market changes from the store defaults, as the Graph view lists it. */
export type MarketOverride = {
  key: 'currency' | 'catalog' | 'domain' | 'languages' | 'adjustment'
  value: string
}

type OverrideContext = {
  /** The store's main domain, which subfolders hang off. */
  primaryHost: string
  /** A catalog's name by id; null when it is unknown (deleted or not readable). */
  catalogName: (id: string) => string | null
  languageName: (code: string) => string
}

/** How a price adjustment reads: +10%, −5%. */
export function adjustmentText(bp: number): string {
  const value = Math.abs(bp) / 100
  return `${bp < 0 ? '−' : '+'}${Number.isInteger(value) ? value : value.toFixed(1)}%`
}

function languagesOf(m: Pick<MarketView, 'locale' | 'locales'>): string[] {
  return [m.locale, ...m.locales]
}

/**
 * What a market overrides, in the order the Graph view shows it: currency, catalog, domain,
 * languages, price adjustment. A setting equal to the primary market's is left out.
 */
export function marketOverrides(
  market: MarketView,
  primary: MarketView | undefined,
  ctx: OverrideContext,
): MarketOverride[] {
  const out: MarketOverride[] = []
  if (market.currency !== (primary?.currency ?? 'INR')) {
    out.push({ key: 'currency', value: market.currency })
  }
  const catalog = market.catalogId ? ctx.catalogName(market.catalogId) : null
  if (catalog) out.push({ key: 'catalog', value: catalog })
  if (market.subfolder) {
    out.push({ key: 'domain', value: `${ctx.primaryHost}/${market.subfolder}` })
  } else if (market.hostname) {
    out.push({ key: 'domain', value: market.hostname })
  }
  const own = languagesOf(market)
  const base = primary ? languagesOf(primary) : ['en']
  if (own.join(',') !== base.join(',')) {
    out.push({ key: 'languages', value: own.map(ctx.languageName).join(', ') })
  }
  if (market.priceAdjustmentBp !== 0) {
    out.push({ key: 'adjustment', value: adjustmentText(market.priceAdjustmentBp) })
  }
  return out
}
