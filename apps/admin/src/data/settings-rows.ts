/**
 * The row lists settings pages open on (Shopify's row list + detail pattern, #147): each row's
 * title and its current value in a few words. Page titles and detail copy stay in each page's
 * own `data/<feature>.ts`.
 */
export const settingsRowsContent = {
  needsFix: 'Needs a fix',
  notSet: 'Not set',
  on: 'On',
  off: 'Off',

  taxes: {
    back: 'GST & invoices',
    gstNumbers: 'GST numbers',
    gstCount: (n: number) => (n === 0 ? 'None added' : n === 1 ? '1 number' : `${n} numbers`),
    registration: 'GST registration',
    notRegistered: 'Not registered',
    charging: 'How you charge GST',
    composition: 'Composition scheme',
    rate: (rate: number, inclusive: boolean) =>
      `${rate}% · ${inclusive ? 'prices include GST' : 'added on top'}`,
    invoices: 'Invoice numbers',
    invoiceNext: (sample: string) => `Next: ${sample}`,
    einvoice: 'E-invoicing (IRN)',
    einvoiceValue: 'Coming soon',
  },
} as const
