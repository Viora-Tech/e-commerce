/** SOURCE OF TRUTH: COUNTRY_CODES, MARKET_CURRENCIES, MARKET_LANGUAGES, SUBFOLDER_PATTERN,
 *   marketPaths, pathClash, suggestSubfolder, currencyForCountry
 * WHAT:  The pure half of Settings → Markets: every ISO country, the currencies and languages a
 *        market offers, the subfolder rule, and the first path segments each market answers on
 *        the store's main domain. No database.
 * WHY:   The admin dialog warns about a clash while the merchant types, and the market service
 *        refuses the same clash, from one rule (markets/service.ts).
 */

/** ISO 3166-1 alpha-2: every assigned country and territory code (249). */
export const COUNTRY_CODES: readonly string[] = `
  AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ
  BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ
  CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ
  DE DJ DK DM DO DZ
  EC EE EG EH ER ES ET
  FI FJ FK FM FO FR
  GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY
  HK HM HN HR HT HU
  ID IE IL IM IN IO IQ IR IS IT
  JE JM JO JP
  KE KG KH KI KM KN KP KR KW KY KZ
  LA LB LC LI LK LR LS LT LU LV LY
  MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ
  NA NC NE NF NG NI NL NO NP NR NU NZ
  OM
  PA PE PF PG PH PK PL PM PN PR PS PT PW PY
  QA
  RE RO RS RU RW
  SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ
  TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ
  UA UG UM US UY UZ
  VA VC VE VG VI VN VU
  WF WS
  YE YT
  ZA ZM ZW
`
  .trim()
  .split(/\s+/)

const COUNTRY_SET = new Set(COUNTRY_CODES)

export function isCountryCode(code: string): boolean {
  return COUNTRY_SET.has(code)
}

/** The currencies the admin offers a market. The primary market keeps the store's own (INR). */
export const MARKET_CURRENCIES = [
  'AED',
  'USD',
  'EUR',
  'GBP',
  'SAR',
  'QAR',
  'KWD',
  'OMR',
  'BHD',
  'SGD',
  'AUD',
  'CAD',
  'MYR',
  'NPR',
  'LKR',
  'BDT',
  'JPY',
  'CHF',
  'NZD',
  'HKD',
  'ZAR',
] as const

/** Languages a market can show the storefront in (BCP 47 language codes, `market.locale`). */
export const MARKET_LANGUAGES = [
  'en',
  'hi',
  'ar',
  'fr',
  'de',
  'es',
  'it',
  'pt',
  'ja',
  'zh',
  'ta',
  'te',
  'mr',
  'bn',
  'gu',
  'kn',
  'ml',
  'pa',
  'ur',
] as const
export type MarketLanguage = (typeof MARKET_LANGUAGES)[number]

export function isMarketLanguage(code: string): code is MarketLanguage {
  return (MARKET_LANGUAGES as readonly string[]).includes(code)
}

/**
 * The `market_subfolder` check: `ae`, or two pairs like `en-us`. Two-letter parts only, so a
 * subfolder can never shadow a storefront route (`/products`, `/cart`).
 */
export const SUBFOLDER_PATTERN = /^[a-z]{2}(-[a-z]{2})?$/

/** What decides a market's addresses on the main domain. */
export type MarketPathInput = {
  isPrimary: boolean
  subfolder: string | null
  locale: string
  locales: readonly string[]
}

/**
 * The first path segments a market answers on the store's main domain, as the storefront proxy
 * reads them (`apps/storefront/src/lib/markets.ts`): its subfolder, and `<lang>-<place>` for
 * each of its languages, the place being the subfolder's last part (`/ae`, `/en-ae`, `/ar-ae`;
 * `/en-us`, `/es-us`). The primary market answers `/<lang>` for its other languages (`/hi`). A
 * market reached by its own domain or by the shopper's choice claims none here.
 */
export function marketPaths(m: MarketPathInput): string[] {
  if (m.isPrimary) return m.locales.filter((l) => l !== m.locale)
  if (!m.subfolder) return []
  const place = m.subfolder.split('-').pop() ?? m.subfolder
  return [...new Set([m.subfolder, ...[m.locale, ...m.locales].map((l) => `${l}-${place}`)])]
}

/**
 * The first of `m`'s addresses (its subfolder first) that one of `others` already answers on,
 * with that market; null when none.
 */
export function pathClash<T extends MarketPathInput>(
  m: MarketPathInput,
  others: readonly T[],
): { path: string; market: T } | null {
  for (const path of marketPaths(m)) {
    const market = others.find((o) => marketPaths(o).includes(path))
    if (market) return { path, market }
  }
  return null
}

/**
 * The subfolder the dialog proposes for a market whose first country is `country`: `ae`, or
 * `en-ae` when `ae` is taken (`taken`: every address other markets claim).
 */
export function suggestSubfolder(
  country: string,
  locale: string,
  taken: readonly string[],
): string {
  const code = country.toLowerCase()
  return [code, `${locale}-${code}`].find((s) => !taken.includes(s)) ?? code
}

/** Each offered currency and the countries that pay in it, for the dialog's first guess. */
const CURRENCY_COUNTRIES: Record<(typeof MARKET_CURRENCIES)[number], string> = {
  AED: 'AE',
  USD: 'US PR GU VI AS MP EC SV TL FM MH PW TC VG BQ',
  EUR: 'AT BE BG HR CY EE FI FR DE GR IE IT LV LT LU MT NL PT SK SI ES AD MC SM VA ME AX GF GP MQ RE YT BL MF PM',
  GBP: 'GB GG JE IM',
  SAR: 'SA',
  QAR: 'QA',
  KWD: 'KW',
  OMR: 'OM',
  BHD: 'BH',
  SGD: 'SG',
  AUD: 'AU CX CC NF KI NR TV',
  CAD: 'CA',
  MYR: 'MY',
  NPR: 'NP',
  LKR: 'LK',
  BDT: 'BD',
  JPY: 'JP',
  CHF: 'CH LI',
  NZD: 'NZ CK NU PN TK',
  HKD: 'HK',
  ZAR: 'ZA',
}

/** The offered currency `country` pays in (`AE` → `AED`), or null when none of them. */
export function currencyForCountry(country: string): string | null {
  const hit = Object.entries(CURRENCY_COUNTRIES).find(([, codes]) =>
    codes.split(' ').includes(country),
  )
  return hit?.[0] ?? null
}
