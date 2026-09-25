import { formatMoney, formatNumber } from '@commerce/money'

/** ₹1,234 (no decimals for whole amounts, kept for fractional ones). */
export function formatPaise(paise: number): string {
  return formatMoney(paise, 'INR')
}

/** ₹1.2L / ₹35K — for stat tiles and chart axes. */
export function formatPaiseCompact(paise: number): string {
  return formatMoney(paise, 'INR', { compact: true })
}

export function formatCompact(n: number): string {
  return formatNumber(n, { compact: true })
}
