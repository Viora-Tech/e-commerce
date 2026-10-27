import type { LiquidMarket } from '@commerce/core'
import { MARKET_HEADERS } from './markets'

/** The page's market for an imported theme, and what its render cache is keyed by. */
export type LiquidMarketScope = { market: LiquidMarket | undefined; key: string }

const NO_MARKET: LiquidMarketScope = { market: undefined, key: '' }

/** `en=/ae,ar=/ar-ae` → each language and where it lives. */
function languagesFrom(value: string | null) {
  return (value ?? '').split(',').flatMap((part) => {
    const at = part.indexOf('=')
    return at > 0 ? [{ code: part.slice(0, at), rootUrl: part.slice(at + 1) }] : []
  })
}

/**
 * The market and language an imported theme renders a page in, from the proxy's market headers
 * (`lib/markets.ts` `marketHeaders`), with every country the store sells to for the theme's
 * country selector. None for a store selling in one country and one language: its pages render,
 * and are cached, as before markets.
 */
export function liquidMarketFor(h: Headers): LiquidMarketScope {
  const id = h.get(MARKET_HEADERS.id)
  if (!id) return NO_MARKET
  const countries = (h.get(MARKET_HEADERS.countries) ?? '').split(',').filter(Boolean)
  const languages = languagesFrom(h.get(MARKET_HEADERS.languages))
  if (countries.length <= 1 && languages.length <= 1) return NO_MARKET
  const locale = h.get(MARKET_HEADERS.locale) ?? languages[0]?.code ?? 'en'
  const country = h.get(MARKET_HEADERS.country) ?? countries[0] ?? ''
  const prefix = h.get(MARKET_HEADERS.prefix) ?? ''
  return {
    market: { id, handle: '', locale, languages, country, countries, prefix },
    key: [id, locale, country, prefix].join(':'),
  }
}
