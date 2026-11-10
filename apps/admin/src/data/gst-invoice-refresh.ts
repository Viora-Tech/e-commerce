/** The invoice page's "Recalculate GST from products" card (GST invoices app). */
export const gstInvoiceRefreshContent = {
  title: 'GST from products',
  body: 'An order keeps the GST it was placed with. If you have since turned on Charge GST or changed a GST rate or HSN, rebuild this invoice from the products as they are now. The number and date stay the same; the price does not change, only how it splits into taxable value and GST.',
  button: 'Recalculate GST',
  done: (n: number) =>
    n === 0
      ? 'Already matches the products'
      : `GST recalculated on ${n} ${n === 1 ? 'line' : 'lines'}`,
} as const

/** The Invoices list's bulk "Recalculate GST": the same rebuild for every selected tax invoice. */
export const gstInvoiceBulkRefreshContent = {
  button: 'Recalculate GST',
  done: (updated: number, unchanged: number, skipped: number) =>
    [
      `GST recalculated on ${updated} ${updated === 1 ? 'invoice' : 'invoices'}`,
      unchanged ? `${unchanged} already matched` : null,
      skipped ? `${skipped} skipped (in a filed GSTR-1, cancelled or not a tax invoice)` : null,
    ]
      .filter(Boolean)
      .join(' · '),
} as const
