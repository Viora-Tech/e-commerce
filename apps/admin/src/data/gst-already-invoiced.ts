/**
 * "Already invoiced" in the GST invoices app: recording a tax invoice the merchant issued
 * outside Koomerce (by hand or in a previous billing system), and how such a record shows on
 * the invoice page and the order card. Split from `gst-invoices.ts`, which is near its size cap.
 * No em or en dashes.
 */
export const gstAlreadyInvoicedContent = {
  /** The Queue row's button. */
  action: 'Already invoiced',
  actionLabel: (order: string) => `${order} was already invoiced`,
  title: (order: string) => `${order} is already invoiced`,
  body: 'Record the invoice you issued earlier, by hand or in your previous billing system. It counts in GSTR-1 and GSTR-3B like any invoice, and no PDF is made or emailed.',
  number: 'Invoice number',
  numberHelp:
    'Exactly as printed on that invoice. Up to 16 letters, digits, / and -. A number already used this financial year is refused.',
  date: 'Invoice date',
  dateHelp: 'The date on that invoice. It decides the GST return month.',
  submit: 'Record invoice',
  recorded: (number: string) => `Recorded ${number}`,
  failed: 'Could not record that invoice',
  /** On the invoice page and the order card, in place of Print and Download. */
  outside: 'Recorded, invoiced outside Koomerce',
  outsideBody:
    'This invoice was issued outside Koomerce, so there is no PDF here. It is counted in your GST returns.',
} as const
