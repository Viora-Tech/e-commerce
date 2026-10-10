import { currencyDigits } from '@commerce/core/inventory'
import { formatMoney, formatNumber } from '@commerce/money'
import { INTL_LOCALE, type Locale } from '@/lib/i18n'

/** ₹1,234 (no decimals for whole amounts, kept for fractional ones). */
export function formatPaise(paise: number, locale: Locale = 'en'): string {
  return formatMoney(paise, 'INR', { locale: INTL_LOCALE[locale] })
}

/** ₹1.2L / ₹35K (Hindi: ₹1.2 लाख / ₹35 हज़ार) — for stat tiles and chart axes. */
export function formatPaiseCompact(paise: number, locale: Locale = 'en'): string {
  return formatMoney(paise, 'INR', { compact: true, locale: INTL_LOCALE[locale] })
}

export function formatCompact(n: number, locale: Locale = 'en'): string {
  return formatNumber(n, { compact: true, locale: INTL_LOCALE[locale] })
}

/** A purchase amount in its own currency: ₹1,234 for INR, "USD 1,234.50" for the rest. */
export function formatMinor(minor: number, currency: string, locale: Locale = 'en'): string {
  if (currency === 'INR') return formatPaise(minor, locale)
  const digits = currencyDigits(currency)
  const amount = formatNumber(minor / 10 ** digits, {
    locale: INTL_LOCALE[locale],
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
  return `${currency} ${amount}`
}
