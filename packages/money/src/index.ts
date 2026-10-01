/**
 * Currency-aware money formatting. Pure, zero runtime dependencies, safe to import from
 * client components as well as server code — this is the one place `Intl.NumberFormat`
 * should be called for money in the repo (see `scripts/sweeps/money-format.test.ts`).
 *
 * Amounts are always integer minor units (paise for INR, cents for USD/EUR) at rest —
 * in the database, in API payloads, in props. They only become major-unit display
 * strings here, at render time.
 */

export type Currency = 'INR' | 'EUR' | 'USD'

export type CurrencyMeta = {
  /** ISO 4217 code. */
  code: Currency
  /** Display symbol. */
  symbol: string
  /** Number of minor units per major unit (2 for paise/cents on all three today). */
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

  const isWhole = Number.isInteger(major)
  const fractionDigits = opts.showZeroDecimals || !isWhole ? meta.minorUnit : 0

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: meta.code,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(major)
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
