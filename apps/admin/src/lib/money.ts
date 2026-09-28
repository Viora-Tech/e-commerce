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
