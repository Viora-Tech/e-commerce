import { isBotUserAgent } from '@commerce/core/marketing'
import type { StoreMarketRoute } from '@commerce/db'
import { pickMarket, withoutMarketSegment } from './markets'

/**
 * "Shopping from the UAE? Shop in AED": whether to suggest the market of the visitor's country,
 * and which one. Pure (tested in `market-suggestion.test.ts`); the `/theme-actions/market-suggestion`
 * route answers it per visitor, never inside a cached page. The visitor's country only suggests:
 * the URL keeps deciding what is shown, so crawlers and cached pages stay on the market they asked for.
 */

export type MarketSuggestion = {
  /** The visitor's country (Cloudflare's `cf-ipcountry`), the one to switch to. */
  country: string
  /** The suggested market's currency. */
  currency: string
  /** What the page shows now: what "Stay" saves. */
  current: { country: string; currency: string; language: string }
}

const COUNTRY = /^[A-Z]{2}$/

/** Checkout and the shopper account never show it, in any market's copy (`/ae/checkout`). */
const ISOLATED = /^\/(?:checkout|account)(?:\/|$)/

export const isSuggestionFreePath = (pathname: string): boolean =>
  ISOLATED.test(pathname) || ISOLATED.test(withoutMarketSegment(pathname))

export function marketSuggestion(input: {
  markets: StoreMarketRoute[]
  hostname: string
  primaryHostname: string | null
  /** The page being viewed, as the browser shows it (with any market prefix). */
  pathname: string
  /** The `wc_market` cookie: any saved choice means the shopper already chose. */
  cookie: string | null | undefined
  visitorCountry: string | null | undefined
  userAgent: string | null | undefined
}): MarketSuggestion | null {
  const country = input.visitorCountry?.trim().toUpperCase() ?? ''
  if (!COUNTRY.test(country)) return null
  if (input.cookie) return null
  if (isBotUserAgent(input.userAgent)) return null
  if (isSuggestionFreePath(input.pathname)) return null
  const live = input.markets.filter((m) => m.enabled || m.isPrimary)
  if (live.length < 2) return null
  const target = live.find((m) => m.countries.includes(country))
  if (!target) return null
  const here = pickMarket({
    markets: input.markets,
    hostname: input.hostname,
    primaryHostname: input.primaryHostname,
    pathname: input.pathname,
    cookie: null,
  })
  if (target.id === here.market.id) return null
  return {
    country,
    currency: target.currency,
    current: { country: here.country, currency: here.market.currency, language: here.locale },
  }
}
