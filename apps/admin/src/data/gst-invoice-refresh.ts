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
