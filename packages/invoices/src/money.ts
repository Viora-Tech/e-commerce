/**
 * Money on documents. Amounts are integer paise everywhere; formatting is the
 * only place they become rupees. Adapted from invoicely's `formatCurrencyText`
 * (MIT), narrowed to INR with the Indian digit grouping (1,23,456.00).
 */
import { formatMoney, formatNumber } from '@commerce/money'

/** "₹1,23,456.78"; negative amounts keep the sign in front of the symbol. */
export function formatRupees(paise: number): string {
  return formatMoney(paise, 'INR', { showZeroDecimals: true })
}

/** "1,23,456.78" for table cells where the column header carries the currency. */
export function formatAmount(paise: number): string {
  return formatNumber(paise / 100, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** "18%" or "2.5%". */
export function formatRate(percent: number): string {
  return `${Number.isInteger(percent) ? percent : percent.toFixed(1)}%`
}
