/**
 * Currency-aware money formatting. Pure, zero runtime dependencies, safe to import from
 * client components as well as server code — this is the one place `Intl.NumberFormat`
 * should be called for money in the repo (see `scripts/sweeps/money-format.test.ts`).
 *
 * Amounts are always integer minor units (paise for INR, cents for USD/EUR) at rest —
 * in the database, in API payloads, in props. They only become major-unit display
 * strings here, at render time.
 */

export type Currency =
  | 'INR'
  | 'EUR'
  | 'USD'
  | 'AED'
  | 'GBP'
  | 'SAR'
  | 'QAR'
  | 'KWD'
  | 'OMR'
  | 'BHD'
  | 'SGD'
  | 'AUD'
  | 'CAD'
  | 'MYR'
  | 'NPR'
  | 'LKR'
  | 'BDT'
  | 'JPY'
  | 'CHF'
  | 'NZD'
  | 'HKD'
  | 'ZAR'

export type CurrencyMeta = {
  /** ISO 4217 code. */
  code: Currency
  /** Display symbol. */
  symbol: string
  /** Decimal places of the minor unit (ISO 4217): 2 for paise and cents, 3 for Gulf dinars, 0 for yen. */
  minorUnit: number
  /** BCP 47 locale used when the caller doesn't pass one. */
  defaultLocale: string
}

/**
 * Default locale per currency: INR -> en-IN (Indian digit grouping, 1,23,456), USD ->
 * en-US, EUR -> en-IE (Irish English formatting reads naturally for an English-first
 * admin UI while still using the euro sign and European grouping; de-DE is the other
 * common choice but swaps the decimal/group separators, which we don't want here).
 */
export const CURRENCIES: Record<Currency, CurrencyMeta> = {
  INR: { code: 'INR', symbol: '₹', minorUnit: 2, defaultLocale: 'en-IN' },
  USD: { code: 'USD', symbol: '$', minorUnit: 2, defaultLocale: 'en-US' },
  EUR: { code: 'EUR', symbol: '€', minorUnit: 2, defaultLocale: 'en-IE' },
  // Markets' currencies (`MARKET_CURRENCIES` in @commerce/core): what a shopper abroad sees.
  AED: { code: 'AED', symbol: 'AED', minorUnit: 2, defaultLocale: 'en-AE' },
  GBP: { code: 'GBP', symbol: '£', minorUnit: 2, defaultLocale: 'en-GB' },
  SAR: { code: 'SAR', symbol: 'SAR', minorUnit: 2, defaultLocale: 'en-SA' },
  QAR: { code: 'QAR', symbol: 'QAR', minorUnit: 2, defaultLocale: 'en-QA' },
  KWD: { code: 'KWD', symbol: 'KWD', minorUnit: 3, defaultLocale: 'en-KW' },
  OMR: { code: 'OMR', symbol: 'OMR', minorUnit: 3, defaultLocale: 'en-OM' },
  BHD: { code: 'BHD', symbol: 'BHD', minorUnit: 3, defaultLocale: 'en-BH' },
  SGD: { code: 'SGD', symbol: 'S$', minorUnit: 2, defaultLocale: 'en-SG' },
  AUD: { code: 'AUD', symbol: 'A$', minorUnit: 2, defaultLocale: 'en-AU' },
  CAD: { code: 'CAD', symbol: 'CA$', minorUnit: 2, defaultLocale: 'en-CA' },
  MYR: { code: 'MYR', symbol: 'RM', minorUnit: 2, defaultLocale: 'en-MY' },
  NPR: { code: 'NPR', symbol: 'Rs', minorUnit: 2, defaultLocale: 'en-NP' },
  LKR: { code: 'LKR', symbol: 'Rs', minorUnit: 2, defaultLocale: 'en-LK' },
  BDT: { code: 'BDT', symbol: '৳', minorUnit: 2, defaultLocale: 'en-BD' },
  JPY: { code: 'JPY', symbol: '¥', minorUnit: 0, defaultLocale: 'en-JP' },
  CHF: { code: 'CHF', symbol: 'CHF', minorUnit: 2, defaultLocale: 'de-CH' },
  NZD: { code: 'NZD', symbol: 'NZ$', minorUnit: 2, defaultLocale: 'en-NZ' },
  HKD: { code: 'HKD', symbol: 'HK$', minorUnit: 2, defaultLocale: 'en-HK' },
  ZAR: { code: 'ZAR', symbol: 'R', minorUnit: 2, defaultLocale: 'en-ZA' },
}

/** True for a currency this package formats (an ISO 4217 code in `CURRENCIES`). */
export function isCurrency(code: string): code is Currency {
  return Object.hasOwn(CURRENCIES, code)
}

export const DEFAULT_CURRENCY: Currency = 'INR'

export type FormatMoneyOptions = {
  /** BCP 47 locale override. Defaults to the currency's `defaultLocale`. */
  locale?: string
  /** Compact notation: ₹1.2L / $1.2K / €1.2K. Defaults to false. */
  compact?: boolean
  /**
   * When true, always show the currency's full decimal precision (₹1,234.00), even for
   * a whole amount. When false (default), a whole amount is shown without decimals
   * (₹1,234) and a fractional one keeps its decimals (₹1,234.50). Ignored when
   * `compact` is true (compact always caps at 1 fraction digit).
   */
  showZeroDecimals?: boolean
  /**
   * Round to the currency's whole major unit and show no decimals: totals and averages
   * across many orders (₹2,76,370, $1,204). Uses the currency's own minor unit, so it is
   * right for every currency. Ignored when `compact` is true.
   */
  whole?: boolean
}

/**
 * Hindi compact units in the Indian system. hi-IN's own compact notation abbreviates
 * ("₹1.2 क॰") and switches to अरब above 100 crore, which merchants don't say; this spells
 * हज़ार / लाख / करोड़ out and stays in crore.
 */
const HINDI_UNITS = [
  { size: 1e7, word: 'करोड़' },
  { size: 1e5, word: 'लाख' },
  { size: 1e3, word: 'हज़ार' },
] as const

function isHindi(locale: string): boolean {
  return locale === 'hi' || locale.startsWith('hi-')
}

/** "1.2 लाख", "12.3 हज़ार", "950"; one fraction digit at most, like the Intl compact form. */
function hindiCompact(n: number, locale: string): string {
  const abs = Math.abs(n)
  const digits = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 })
  const round = (v: number) => Math.round(v * 10) / 10
  const unit = HINDI_UNITS.find((u) => abs >= u.size)
  if (!unit) return digits.format(n)
  const sign = n < 0 ? '-' : ''
  const scaled = round(abs / unit.size)
  // Rounding can reach the next unit: 99,990 reads "1 लाख", not "100 हज़ार".
  const bigger = HINDI_UNITS[HINDI_UNITS.indexOf(unit) - 1]
  if (bigger && scaled * unit.size >= bigger.size) {
    return `${sign}${digits.format(round(abs / bigger.size))} ${bigger.word}`
  }
  return `${sign}${digits.format(scaled)} ${unit.word}`
}

function minorToMajor(minor: number, currency: Currency): number {
  const { minorUnit } = CURRENCIES[currency]
  return minor / 10 ** minorUnit
}

/** Convert a major-unit amount (rupees/dollars/euros) to integer minor units. */
export function toMinor(major: number, currency: Currency = DEFAULT_CURRENCY): number {
  const { minorUnit } = CURRENCIES[currency]
  return Math.round(major * 10 ** minorUnit)
}

/** Plain decimal rupees: "499", "12.5", ".75". No sign, exponent, grouping or symbol. */
const RUPEES_TEXT = /^(\d+\.?\d*|\.\d+)$/

/**
 * SOURCE OF TRUTH KEYWORDS: parseRupees, toPaise, rupees to paise, amount field
 * WHAT:  Rupees a merchant typed → whole paise, rounded to the nearest paisa; null for
 *        empty, junk or negative text. Zero is a valid amount (callers that need > 0 check).
 * WHY:   Eight admin forms each had their own `toPaise` (NaN vs 0 vs null for junk,
 *        parseFloat accepting "12abc"). One rule here. Rounds via the decimal string
 *        (`"1.005e2"`) so 1.005 → 101 paise, not 100 from float drift.
 * WHERE: Admin amount fields (orders, refunds, returns, drafts, gift cards, purchase
 *        orders, settings, products) and the catalog CSV import; duplicate-helpers sweep.
 */
export function parseRupees(text: string): number | null {
  const t = text.trim()
  if (!RUPEES_TEXT.test(t)) return null
  const paise = Math.round(Number(`${t.endsWith('.') ? t.slice(0, -1) : t}e2`))
  return Number.isSafeInteger(paise) ? paise : null
}

/** Convert integer minor units to a major-unit amount. Does not format. */
export function fromMinor(minor: number, currency: Currency = DEFAULT_CURRENCY): number {
  return minorToMajor(minor, currency)
}

/**
 * Format an integer minor-unit amount as a currency string.
 *
 * `formatMoney(123400_00, 'INR')` -> "₹1,23,400.00"
 * `formatMoney(123400_00, 'INR', { compact: true })` -> "₹1.2L"
 * `formatMoney(0, 'INR')` -> "₹0"
 */
export function formatMoney(
  minor: number,
  currency: Currency = DEFAULT_CURRENCY,
  opts: FormatMoneyOptions = {},
): string {
  const meta = CURRENCIES[currency]
  const locale = opts.locale ?? meta.defaultLocale
  const major = minorToMajor(minor, currency)

  if (opts.compact && isHindi(locale)) {
    const text = hindiCompact(major, locale)
    return text.startsWith('-') ? `-${meta.symbol}${text.slice(1)}` : `${meta.symbol}${text}`
  }
  if (opts.compact) {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: meta.code,
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(major)
  }

  const value = opts.whole ? Math.round(major) : major
  const isWhole = Number.isInteger(value)
  const fractionDigits = !opts.whole && (opts.showZeroDecimals || !isWhole) ? meta.minorUnit : 0

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: meta.code,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value)
}

/** Format a plain (unitless) number with the currency's locale digit grouping. */
export function formatNumber(
  n: number,
  opts: {
    locale?: string
    compact?: boolean
    minimumFractionDigits?: number
    maximumFractionDigits?: number
  } = {},
): string {
  const locale = opts.locale ?? CURRENCIES[DEFAULT_CURRENCY].defaultLocale
  if (opts.compact && isHindi(locale)) return hindiCompact(n, locale)
  return new Intl.NumberFormat(locale, {
    notation: opts.compact ? 'compact' : 'standard',
    maximumFractionDigits: opts.compact ? 1 : opts.maximumFractionDigits,
    minimumFractionDigits: opts.compact ? undefined : opts.minimumFractionDigits,
  }).format(n)
}

/**
 * "+₹49" / "−₹99.98": a fee or discount row. The minus is U+2212 so it lines up with the
 * plus in a column of figures.
 */
export function formatSignedMoney(
  minor: number,
  currency: Currency = DEFAULT_CURRENCY,
  opts: FormatMoneyOptions = {},
): string {
  return `${minor < 0 ? '−' : '+'}${formatMoney(Math.abs(minor), currency, opts)}`
}

/**
 * SOURCE OF TRUTH KEYWORDS: formatPercent, style percent, conversion rate
 * WHAT:  A ratio (0.256) as a percentage ("26%") in the locale's digits.
 * WHY:   Percent formatters were hand-built per screen (and allow-listed by the
 *        money-format sweep); this is the one `Intl.NumberFormat` percent call.
 * WHERE: Admin analytics deltas, insights, abandoned-cart tiles.
 */
export function formatPercent(
  ratio: number,
  opts: { locale?: string; maximumFractionDigits?: number } = {},
): string {
  return new Intl.NumberFormat(opts.locale ?? CURRENCIES[DEFAULT_CURRENCY].defaultLocale, {
    style: 'percent',
    maximumFractionDigits: opts.maximumFractionDigits ?? 0,
  }).format(ratio)
}

/** Longest money format a store can save; Shopify's own run to a few dozen characters. */
export const MONEY_FORMAT_MAX = 60

/** A `{{ amount… }}` placeholder: what makes a money format show the amount at all. */
const AMOUNT_TAG = /{{\s*amount\w*\s*}}/

/** True when `format` shows the amount (`Rs. {{amount}}`, `₹{{ amount_no_decimals }}`). */
export function isMoneyFormat(format: string): boolean {
  return format.length <= MONEY_FORMAT_MAX && AMOUNT_TAG.test(format)
}

const ENTITIES: Record<string, string> = { amp: '&', nbsp: ' ', quot: '"', apos: "'" }

/**
 * A money format as Shopify stores it (`shop.currencyFormats.moneyFormat`, HTML such as
 * `<span class=money>Rs. {{amount}}</span>` or `&#8377;{{amount}}`) as plain text, or null
 * when nothing usable is left. Tags go and entities decode: the format is shown as text.
 */
export function cleanMoneyFormat(raw: string | null | undefined): string | null {
  if (!raw) return null
  const text = raw
    .replace(/<[^>]*>/g, '')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(Number.parseInt(n, 16)))
    .replace(/&(amp|nbsp|quot|apos);/g, (_, n: string) => ENTITIES[n] ?? '')
    .replace(/[<>]/g, '')
    .trim()
  return isMoneyFormat(text) ? text : null
}

/**
 * SOURCE OF TRUTH KEYWORDS: money_format, shopifyMoney, Rs. {{amount}}, store money format
 * WHAT:  An integer minor-unit amount in a Shopify-style money format: `{{amount}}`
 *        (6,499.00), `{{amount_no_decimals}}` (6,499), comma, apostrophe and space variants.
 * WHY:   A store moved from Shopify keeps how its prices read ("Rs. 6,499.00"); the Liquid
 *        `money` filters and the storefront's own blocks both format through this.
 * WHERE: `formatStoreMoney` below, theme-import `money` filters.
 */
export function formatWithMoneyFormat(minor: number, format: string): string {
  const major = minor / 100
  const group = (n: string, sep: string) => n.replace(/\B(?=(\d{3})+(?!\d))/g, sep)
  const parts = (decimals: number, thousands: string, point: string) => {
    const [whole = '0', frac] = Math.abs(major).toFixed(decimals).split('.')
    const sign = major < 0 ? '-' : ''
    return `${sign}${group(whole, thousands)}${frac ? `${point}${frac}` : ''}`
  }
  return format.replace(/{{\s*(\w+)\s*}}/g, (_, name: string) => {
    switch (name) {
      case 'amount':
        return parts(2, ',', '.')
      case 'amount_no_decimals':
        return parts(0, ',', '.')
      case 'amount_with_comma_separator':
        return parts(2, '.', ',')
      case 'amount_no_decimals_with_comma_separator':
        return parts(0, '.', ',')
      case 'amount_with_apostrophe_separator':
        return parts(2, "'", '.')
      case 'amount_no_decimals_with_space_separator':
        return parts(0, ' ', '.')
      case 'amount_with_space_separator':
        return parts(2, ' ', ',')
      default:
        return parts(2, ',', '.')
    }
  })
}

/**
 * A price as the store shows prices: its money format when it set one (Settings › Store
 * details, or brought over from Shopify), else `formatMoney` (₹6,499). Display only:
 * amounts stay integer minor units everywhere else.
 */
export function formatStoreMoney(
  minor: number,
  format: string | null | undefined,
  currency: Currency = DEFAULT_CURRENCY,
): string {
  return format && isMoneyFormat(format)
    ? formatWithMoneyFormat(minor, format)
    : formatMoney(minor, currency)
}

/**
 * A Shopify-style money format for a currency, read off how it formats (`${{amount}}`,
 * `AED {{amount}}`, `¥{{amount_no_decimals}}`): what an imported theme's scripts format prices
 * with when the page's market shows that currency instead of the store's own format.
 */
export function moneyFormatOf(currency: Currency): string {
  const { minorUnit } = CURRENCIES[currency]
  const tag = minorUnit === 0 ? '{{amount_no_decimals}}' : '{{amount}}'
  return formatMoney(toMinor(1234.5, currency), currency, { showZeroDecimals: true })
    .replace(/\d[\d.,'’\s ]*\d/, tag)
    .replace(/ /g, ' ')
}

/*
 * Market prices (Settings → Markets): a rupee price in a market's currency, Shopify Markets
 * style. Rupees × the market's rate (its fixed rate, else the day's reference rate) × its price
 * adjustment, then its rounding. Prices, reports and GST stay in paise; only what a shopper
 * abroad sees is converted, by this one rule on the store, cart and checkout. Market rows and
 * reference rates are read in @commerce/core (`marketPricing`, `storeMarketPricing`).
 */

export type MarketRoundingRule = 'none' | 'whole' | 'x99'

/** How one market prices: what `presentmentMinor` needs. */
export type MarketPricing = {
  /** ISO 4217 code the shopper sees. */
  currency: string
  /** Units of `currency` per rupee. */
  rate: number
  /** Basis points on top of the converted price: +1000 is 10% above. */
  adjustmentBp: number
  rounding: MarketRoundingRule
}

/** Rupees as rupees: the primary market, or a market whose rate is not known yet. */
export const RUPEE_PRICING: MarketPricing = {
  currency: 'INR',
  rate: 1,
  adjustmentBp: 0,
  rounding: 'none',
}

/** Decimal places of a currency's minor unit (ISO 4217); 2 for a code not in `CURRENCIES`. */
function minorDigits(currency: string): number {
  return isCurrency(currency) ? CURRENCIES[currency].minorUnit : 2
}

/** True when prices show as stored, in rupees. */
function isRupeePricing(p: MarketPricing): boolean {
  return p.currency === 'INR' && p.rate === 1 && p.adjustmentBp === 0
}

/**
 * Paise in the market's currency, as whole minor units. Rounding comes last, after the rate
 * and the adjustment: `whole` to the nearest whole unit (14.27 → 14.00), `x99` up to the next
 * .99 (14.27 → 14.99, 14.00 → 14.99; whole units for a currency without decimals). Zero and
 * negative amounts (a discount line) keep their sign and are rounded by the same rule.
 */
export function presentmentMinor(paise: number, p: MarketPricing): number {
  if (isRupeePricing(p)) return paise
  if (paise === 0) return 0
  const sign = paise < 0 ? -1 : 1
  const digits = minorDigits(p.currency)
  const scale = 10 ** digits
  const major = (Math.abs(paise) / 100) * p.rate * (1 + p.adjustmentBp / 10_000)
  let units: number
  if (p.rounding === 'whole') units = Math.round(major) * scale
  else if (p.rounding === 'x99') {
    // .99 of the unit: 1 cent off the next whole dollar, 10 fils off the next whole dinar.
    units = digits === 0 ? Math.ceil(major) : (Math.floor(major + 1e-9) + 1) * scale - scale / 100
  } else units = Math.round(major * scale)
  return sign * Math.max(units, 0)
}

/**
 * A price as Liquid holds money: hundredths of the market's currency (Shopify's subunit
 * amounts, also for dinars and yen), so a theme's `| money` and its scripts divide by 100.
 * Rupees stay paise.
 */
export function presentmentCents(paise: number, p: MarketPricing | null): number {
  if (!p || isRupeePricing(p)) return paise
  return Math.round((presentmentMinor(paise, p) / 10 ** minorDigits(p.currency)) * 100)
}

/** Paise as a shopper in this market reads them (`AED 23.50`); rupees without a market. */
export function formatPresentment(paise: number, p: MarketPricing | null): string {
  if (!p || isRupeePricing(p) || !isCurrency(p.currency)) return formatMoney(paise, 'INR')
  return formatMoney(presentmentMinor(paise, p), p.currency)
}
