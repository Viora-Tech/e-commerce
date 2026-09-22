/**
 * Money on documents. Amounts are integer paise everywhere; formatting is the
 * only place they become rupees. Adapted from invoicely's `formatCurrencyText`
 * (MIT), narrowed to INR with the Indian digit grouping (1,23,456.00).
 */
const rupees = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const plain = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** "₹1,23,456.78"; negative amounts keep the sign in front of the symbol. */
export function formatRupees(paise: number): string {
  return rupees.format(paise / 100)
}

/** "1,23,456.78" for table cells where the column header carries the currency. */
export function formatAmount(paise: number): string {
  return plain.format(paise / 100)
}

/** "18%" or "2.5%". */
export function formatRate(percent: number): string {
  return `${Number.isInteger(percent) ? percent : percent.toFixed(1)}%`
}
