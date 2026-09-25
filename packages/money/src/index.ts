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

function minorToMajor(minor: number, currency: Currency): number {
  const { minorUnit } = CURRENCIES[currency]
  return minor / 10 ** minorUnit
}

/** Convert a major-unit amount (rupees/dollars/euros) to integer minor units. */
export function toMinor(major: number, currency: Currency = DEFAULT_CURRENCY): number {
  const { minorUnit } = CURRENCIES[currency]
  return Math.round(major * 10 ** minorUnit)
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
  return new Intl.NumberFormat(locale, {
    notation: opts.compact ? 'compact' : 'standard',
    maximumFractionDigits: opts.compact ? 1 : opts.maximumFractionDigits,
    minimumFractionDigits: opts.compact ? undefined : opts.minimumFractionDigits,
  }).format(n)
}
