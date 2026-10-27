/** SOURCE OF TRUTH: Liquid localization, markets in imported themes — WHAT: `localization`, `request.locale`, `routes` and the shop's locales for the page's market / WHY: a Shopify theme's country and language selector lists the store's markets and posts the choice to our handler */
import { CURRENCIES, type Currency } from '@commerce/money'
import { LIQUID_ROUTES } from './drops'

/** The market and language a page renders in (the storefront's `lib/markets.ts` picks it). */
export type LiquidMarket = {
  /** The market's id; blank while the store has no market rows. */
  id: string
  handle: string
  /** The page's language (ISO 639-1). */
  locale: string
  /** Languages this market offers, its own first, each with where that language lives here. */
  languages: readonly { code: string; rootUrl: string }[]
  /** The shopper's country (ISO 3166-1). */
  country: string
  /** Every country the store sells to, across its markets: the theme's country selector. */
  countries: readonly string[]
  /** `/ae`, `/ar-ae`, `/hi`; '' for the host's own market in its own language. */
  prefix: string
}

/** India in English: a page whose request names no market. */
export const DEFAULT_LIQUID_MARKET: LiquidMarket = {
  id: '',
  handle: 'india',
  locale: 'en',
  languages: [{ code: 'en', rootUrl: '/' }],
  country: 'IN',
  countries: ['IN'],
  prefix: '',
}

const REGIONS = new Intl.DisplayNames(['en'], { type: 'region' })
const LANGUAGES = new Intl.DisplayNames(['en'], { type: 'language' })
const CURRENCY_NAMES = new Intl.DisplayNames(['en'], { type: 'currency' })

/** An Intl name, or the code itself for one Intl does not know. */
function nameOf(names: Intl.DisplayNames, code: string): string {
  try {
    return names.of(code) ?? code
  } catch {
    return code
  }
}

/** A language in its own words (`العربية`, `हिन्दी`). */
function endonymOf(code: string): string {
  try {
    return new Intl.DisplayNames([code], { type: 'language' }).of(code) ?? code
  } catch {
    return code
  }
}

const symbolOf = (currency: string) => CURRENCIES[currency as Currency]?.symbol ?? currency

/** Shopify's `routes` inside a market: every own URL under its prefix. */
function routesFor(prefix: string) {
  if (!prefix) return LIQUID_ROUTES
  return Object.fromEntries(
    Object.entries(LIQUID_ROUTES).map(([k, url]) => [k, url === '/' ? prefix : `${prefix}${url}`]),
  ) as Record<keyof typeof LIQUID_ROUTES, string>
}

/**
 * The Liquid globals that follow the page's market. Prices stay in the store's own currency
 * until market prices are converted, so every country lists that currency.
 */
export function liquidLocalization(market: LiquidMarket, storeCurrency: string) {
  const currency = {
    iso_code: storeCurrency,
    symbol: symbolOf(storeCurrency),
    name: nameOf(CURRENCY_NAMES, storeCurrency),
  }
  const own = market.languages[0]?.code ?? market.locale
  const languages = market.languages.map((l) => ({
    iso_code: l.code,
    name: nameOf(LANGUAGES, l.code),
    endonym_name: endonymOf(l.code),
    primary: l.code === own,
    root_url: l.rootUrl,
  }))
  const language = languages.find((l) => l.iso_code === market.locale) ?? {
    iso_code: market.locale,
    name: nameOf(LANGUAGES, market.locale),
    endonym_name: endonymOf(market.locale),
    primary: true,
    root_url: market.prefix || '/',
  }
  const countries = [...new Set([...market.countries, market.country])]
    .map((code) => ({
      iso_code: code,
      name: nameOf(REGIONS, code),
      currency,
      unit_system: 'metric',
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
  const country = countries.find((c) => c.iso_code === market.country)
  return {
    routes: routesFor(market.prefix),
    locale: language,
    publishedLocales: languages,
    localization: {
      language,
      country,
      market: { id: market.id, handle: market.handle },
      available_languages: languages,
      available_countries: countries,
    },
  }
}
