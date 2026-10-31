/** Currency codes this package formats, with their symbol, minor unit and default locale. */

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

/** Decimal places of a currency's minor unit (ISO 4217); 2 for a code not in `CURRENCIES`. */
export function minorDigits(currency: string): number {
  return isCurrency(currency) ? CURRENCIES[currency].minorUnit : 2
}
