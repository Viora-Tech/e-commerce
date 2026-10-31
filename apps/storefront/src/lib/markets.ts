import type { StoreMarketRoute } from '@commerce/db'

/**
 * Markets in the storefront (Medusa's `/[countryCode]` routing, Shopify Markets' subfolders):
 * which market, language and country a request is in. Pure, so `proxy.ts` and the theme's
 * country selector (`market-switch.ts`) share one set of rules, all tested (`markets.test.ts`).
 *
 * Order: a URL prefix (`/ae`, `/ar-ae`, `/en-us`, or `/hi` for another language of the host's
 * own market), then a market's own domain, then the shopper's saved choice (the `wc_market`
 * cookie), then the primary market. The visitor's IP country never switches the market by
 * itself: a crawler would index the wrong prices.
 */

/** The shopper's chosen country, plus the language when not the market's own: `AE`, `AE:ar`. */
export const MARKET_COOKIE = 'wc_market'
export const MARKET_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

/** Headers the proxy sets for the app (and strips from the client; see `DERIVED_HEADERS`). */
export const MARKET_HEADERS = {
  /** The market's id; absent while the store has no market rows (India in rupees). */
  id: 'x-market-id',
  currency: 'x-market-currency',
  locale: 'x-market-locale',
  /** The shopper's country: their saved one when it is in the market, else the market's first. */
  country: 'x-market-country',
  /** `/ae`, `/ar-ae`, `/hi` or '' (the host's own market in its own language): before own links. */
  prefix: 'x-market-prefix',
  /** Every country the store sells to, across its markets: `IN,AE,OM`. */
  countries: 'x-market-countries',
  /** Each country's currency, from the market selling there: `IN:INR,AE:AED`. */
  countryCurrencies: 'x-market-country-currencies',
  /** The market's languages, its own first, each with where it lives: `en=/ae,ar=/ar-ae`. */
  languages: 'x-market-languages',
} as const

export type MarketVia = 'prefix' | 'domain' | 'cookie' | 'primary'

/** Where a market and language live: another host (null: this one) and the path prefix there. */
export type MarketRoot = { hostname: string | null; prefix: string }

export type MarketPick = {
  market: StoreMarketRoute
  locale: string
  country: string
  via: MarketVia
  /** The prefix the request URL carried, as written ('' when none). */
  prefix: string
  /** The request path without that prefix: what the storefront routes. */
  pathname: string
  /** Where this market and language belong; a request elsewhere is redirected there. */
  root: MarketRoot
}

/** A two-letter segment, or a `xx-yy` language-and-place one: never a storefront route. */
const SEGMENT = /^[a-z]{2}(?:-[a-z]{2})?$/
const SAVED = /^([A-Z]{2})(?::([a-z]{2}))?$/

/** A store with no market rows yet (made after 0177, before its first save): India in rupees. */
export function fallbackMarket(currency = 'INR'): StoreMarketRoute {
  return {
    id: '',
    handle: 'india',
    isPrimary: true,
    enabled: true,
    currency,
    locale: 'en',
    locales: [],
    subfolder: null,
    hostname: null,
    countries: ['IN'],
  }
}

export const languagesOf = (m: StoreMarketRoute) => [m.locale, ...m.locales]
const placeOf = (subfolder: string) => subfolder.split('-').pop() ?? subfolder
const liveMarkets = (markets: StoreMarketRoute[]) => markets.filter((m) => m.enabled || m.isPrimary)

/** The market whose own domain this is (never the primary: its domain is the store's). */
const domainMarket = (live: StoreMarketRoute[], hostname: string) =>
  live.find((m) => !m.isPrimary && m.hostname === hostname.toLowerCase())

/** A path on this site with its query, from a form's `return_to` or a referer; else `/`. */
function sameSitePath(value: string): string {
  try {
    const url = new URL(value, 'https://store.invalid')
    return url.host === 'store.invalid' ? url.pathname + url.search : '/'
  } catch {
    return '/'
  }
}

function parseSaved(cookie: string | null | undefined) {
  const m = cookie ? SAVED.exec(cookie) : null
  return m?.[1] ? { country: m[1], locale: m[2] ?? null } : null
}

/** The `wc_market` value for a choice. */
export function savedChoice(market: StoreMarketRoute, country: string, locale: string): string {
  return locale === market.locale ? country : `${country}:${locale}`
}

/**
 * Where `market` in `locale` lives, seen from a host whose own market is `home`. Subfolder
 * markets belong to the primary host; a market with a domain to that domain.
 */
function rootOf(
  market: StoreMarketRoute,
  locale: string,
  home: StoreMarketRoute,
  primaryHostname: string | null,
): MarketRoot {
  const own = locale === market.locale
  const lang = own ? '' : `/${locale}`
  if (market.id === home.id) return { hostname: null, prefix: lang }
  if (market.hostname) return { hostname: market.hostname, prefix: lang }
  const elsewhere = home.isPrimary ? null : primaryHostname
  if (market.isPrimary) return { hostname: elsewhere, prefix: lang }
  if (!market.subfolder) return { hostname: elsewhere, prefix: '' }
  const prefix = own ? `/${market.subfolder}` : `/${locale}-${placeOf(market.subfolder)}`
  return { hostname: elsewhere, prefix }
}

/** The market and language a prefix segment names, or null when it names none. */
function fromSegment(live: StoreMarketRoute[], home: StoreMarketRoute, segment: string) {
  if (!SEGMENT.test(segment)) return null
  const exact = live.find((m) => m.subfolder === segment)
  if (exact) {
    // `/en-us` as a market's own subfolder: its language part names the language when offered.
    const lang = segment.slice(0, 2)
    const named = segment.includes('-') && languagesOf(exact).includes(lang)
    return { market: exact, locale: named ? lang : exact.locale }
  }
  const [lang = '', place] = segment.split('-')
  if (place) {
    const market = live.find(
      (m) => m.subfolder && placeOf(m.subfolder) === place && languagesOf(m).includes(lang),
    )
    return market ? { market, locale: lang } : null
  }
  // `/hi`: another language of this host's own market.
  return home.locales.includes(lang) ? { market: home, locale: lang } : null
}

export function pickMarket(input: {
  markets: StoreMarketRoute[]
  hostname: string
  /** The store's primary domain, where the primary market and subfolder markets live. */
  primaryHostname: string | null
  pathname: string
  cookie: string | null | undefined
}): MarketPick {
  const live = liveMarkets(input.markets)
  const primary = live.find((m) => m.isPrimary) ?? fallbackMarket()
  const byDomain = domainMarket(live, input.hostname)
  const home = byDomain ?? primary
  const saved = parseSaved(input.cookie)

  const finish = (
    market: StoreMarketRoute,
    locale: string,
    via: MarketVia,
    prefix = '',
    pathname = input.pathname,
  ): MarketPick => ({
    market,
    locale,
    country:
      saved && market.countries.includes(saved.country)
        ? saved.country
        : (market.countries[0] ?? ''),
    via,
    prefix,
    pathname,
    root: rootOf(market, locale, home, input.primaryHostname),
  })

  const [, first = '', ...rest] = input.pathname.split('/')
  const named = fromSegment(live, home, first.toLowerCase())
  if (named) return finish(named.market, named.locale, 'prefix', `/${first}`, `/${rest.join('/')}`)
  if (byDomain) return finish(byDomain, byDomain.locale, 'domain')
  const chosen = saved ? live.find((m) => m.countries.includes(saved.country)) : undefined
  if (chosen) {
    const locale =
      saved?.locale && languagesOf(chosen).includes(saved.locale) ? saved.locale : chosen.locale
    return finish(chosen, locale, 'cookie')
  }
  return finish(primary, primary.locale, 'primary')
}

/** `IN:INR,AE:AED`: each country once, priced in the first live market that sells there. */
function countryCurrencies(live: StoreMarketRoute[]): string {
  const seen = new Map<string, string>()
  for (const m of live) for (const c of m.countries) if (!seen.has(c)) seen.set(c, m.currency)
  return [...seen].map(([country, currency]) => `${country}:${currency}`).join(',')
}

/**
 * The market headers the app reads (`MARKET_HEADERS`), from the pick and the store's markets:
 * an imported theme's country and language selector renders from them without a lookup.
 */
export function marketHeaders(
  pick: MarketPick,
  markets: StoreMarketRoute[],
  hostname: string,
  primaryHostname: string | null,
): [string, string][] {
  const live = liveMarkets(markets)
  const home = domainMarket(live, hostname) ?? live.find((m) => m.isPrimary) ?? fallbackMarket()
  const languages = languagesOf(pick.market).map((code) => {
    const root = rootOf(pick.market, code, home, primaryHostname)
    const url = `${root.hostname ? `https://${root.hostname}` : ''}${root.prefix}`
    return `${code}=${url || '/'}`
  })
  const out: [string, string][] = [
    [MARKET_HEADERS.currency, pick.market.currency],
    [MARKET_HEADERS.locale, pick.locale],
    [MARKET_HEADERS.prefix, pick.root.hostname ? '' : pick.root.prefix],
    [MARKET_HEADERS.countries, [...new Set(live.flatMap((m) => m.countries))].join(',')],
    [MARKET_HEADERS.countryCurrencies, countryCurrencies(live)],
    [MARKET_HEADERS.languages, languages.join(',')],
  ]
  if (pick.market.id) out.push([MARKET_HEADERS.id, pick.market.id])
  if (pick.country) out.push([MARKET_HEADERS.country, pick.country])
  return out
}

/** Pages a shopper browses: the ones sent to their market's own URL. */
const BROWSE = /^\/(?:$|products|collections|pages|blogs|search|cart|policies)(?:\/|$)/

/**
 * Where to send a browse page that is not at its market's own URL: a saved market's subfolder
 * or domain, or the one way to write a prefix (`/AE` and `/en-ae` → `/ae`). Null: serve it.
 */
export function marketRedirect(pick: MarketPick, search: string): string | null {
  const { hostname, prefix } = pick.root
  if (!BROWSE.test(pick.pathname)) return null
  if (!hostname && prefix === pick.prefix) return null
  const path = prefix && pick.pathname === '/' ? '' : pick.pathname
  return `${hostname ? `https://${hostname}` : ''}${prefix}${path}${search}`
}

/** An own-site path inside the current market (`/products/x` → `/ae/products/x`). */
export function marketPath(prefix: string, path: string): string {
  if (!prefix || !path.startsWith('/') || path.startsWith('//')) return path
  return path === '/' ? prefix : `${prefix}${path}`
}

/**
 * A path without a leading segment that could be a market prefix, whether or not one is set
 * up: for checks that must hold on every market's copy of a page (checkout isolation).
 */
export function withoutMarketSegment(pathname: string): string {
  const [, first = '', ...rest] = pathname.split('/')
  return SEGMENT.test(first.toLowerCase()) ? `/${rest.join('/')}` : pathname
}

/**
 * The theme's country and language selector (`/localization`): the page to go back to in the
 * chosen market and language, and the choice to save. A country no market sells to keeps the
 * current market; a language the market does not offer keeps its own.
 */
export function switchMarket(input: {
  markets: StoreMarketRoute[]
  hostname: string
  primaryHostname: string | null
  /** The page the selector was on: a path on this site, with its query. */
  returnTo: string
  cookie: string | null | undefined
  country: string
  language: string
}): { location: string; saved: string | null } {
  const back = sameSitePath(input.returnTo)
  const q = back.indexOf('?')
  const path = q < 0 ? back : back.slice(0, q)
  const query = q < 0 ? '' : back.slice(q)
  const here = pickMarket({
    markets: input.markets,
    hostname: input.hostname,
    primaryHostname: input.primaryHostname,
    pathname: path,
    cookie: input.cookie,
  })
  const live = liveMarkets(input.markets)
  const country = input.country.trim().toUpperCase()
  const market = live.find((m) => m.countries.includes(country)) ?? here.market
  const same = market.id === here.market.id
  const lang = input.language.trim().toLowerCase()
  const locale = languagesOf(market).includes(lang) ? lang : same ? here.locale : market.locale
  const chosen = market.countries.includes(country)
    ? country
    : same
      ? here.country
      : (market.countries[0] ?? '')
  const primary = live.find((m) => m.isPrimary) ?? fallbackMarket()
  const home = domainMarket(live, input.hostname) ?? primary
  const root = rootOf(market, locale, home, input.primaryHostname)
  const rest = root.prefix && here.pathname === '/' ? '' : here.pathname
  return {
    location: `${root.hostname ? `https://${root.hostname}` : ''}${root.prefix}${rest}${query}`,
    saved: chosen ? savedChoice(market, chosen, locale) : null,
  }
}
