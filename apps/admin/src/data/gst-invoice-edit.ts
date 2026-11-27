/**
 * "Edit invoice" on an issued tax invoice (GST invoices app): the invoice page's card and edit
 * sheet, its version history, the filing reminder on the Queue and Invoices pages, and the
 * order card's "Need to change this invoice?" when editing is allowed. Allowed until the
 * month's GSTR-1 is filed or due (owner, 28 Nov 2026).
 */
export const gstInvoiceEditContent = {
  card: {
    title: 'Edit invoice',
    editable: (due: string) =>
      `Correct quantities, prices, discounts, charges or the buyer until this month's GSTR-1 is filed (due ${due}). The number and date stay the same; taxes and totals are worked out again.`,
    button: 'Edit invoice',
    locked: {
      filed: (month: string) =>
        `${month} is marked filed, so this invoice can no longer be edited.`,
      closed: (month: string) => `${month} is closed. Reopen it on the Returns page to edit.`,
      due_passed: (month: string) =>
        `The GSTR-1 due date for ${month} has passed, so this invoice can no longer be edited.`,
      irn: 'This e-invoice has an IRN, so it cannot be edited.',
      credited: 'A credit note is issued against this invoice, so it can no longer be edited.',
      cancelled: 'This invoice is cancelled.',
      external: 'This invoice was issued in another billing system. Correct it there.',
      not_issued: 'A queued invoice is issued from the order as it is.',
      not_tax_invoice: 'Only a tax invoice can be edited.',
    },
    guidance:
      'To change it now: issue a credit note to reduce it, or a new invoice for anything extra.',
  },
  history: {
    title: 'Edit history',
    count: (n: number) => (n === 1 ? 'Edited 1 time' : `Edited ${n} times`),
    version: (n: number) => (n === 1 ? 'As first issued' : `Before edit ${n}`),
    by: (who: string, when: string) => `${who}, ${when}`,
    total: (amount: string) => `Total ${amount}`,
    taxable: (amount: string) => `taxable ${amount}`,
    reason: (text: string) => `Reason: ${text}`,
    openPdf: 'Open PDF',
    someone: 'A staff member',
  },
  sheet: {
    title: (number: string) => `Edit invoice ${number}`,
    description:
      'Taxes, taxable value, totals, amount in words and the HSN summary are worked out again when you save. The invoice keeps its number and date.',
    items: 'Items',
    item: 'Item',
    quantity: 'Quantity',
    unitPrice: 'Unit price',
    discount: 'Discount',
    lineTotal: 'Line total',
    removeHint: 'Quantity 0 removes the item.',
    charges: 'Charges',
    buyer: 'Buyer',
    buyerName: 'Name',
    address: 'Address',
    addressHelp: 'One printed line per row.',
    gstin: 'GSTIN',
    gstinHelp: 'Leave empty for a consumer.',
    placeOfSupply: 'Place of supply',
    exportPlace: 'Outside India (export)',
    reason: 'Reason for the change (optional)',
    total: 'New total',
    was: (amount: string) => `was ${amount}`,
    save: 'Save changes',
    cancel: 'Cancel',
    close: 'Close',
    discardTitle: 'Discard your changes?',
    discardBody: 'The invoice stays as it is.',
    discard: 'Discard',
    invalid: 'Check the highlighted amounts',
    saved: 'Invoice updated',
    failed: 'Could not save the invoice',
    email: 'Email corrected invoice to buyer',
    emailed: 'Corrected invoice queued for the buyer',
    emailFailed: 'Could not email the invoice',
  },
  reminder: {
    title: (month: string, due: string) => `File ${month} GSTR-1 by ${due}`,
    body: (month: string) =>
      `Then mark ${month} filed on the Returns page. Invoices can be edited until then.`,
    returns: 'Open Returns',
  },
  panel: {
    body: 'This invoice can still be edited, until its month is filed or the GSTR-1 due date passes.',
    steps: [
      'Open the invoice and use Edit invoice to correct quantities, prices, discounts, charges or the buyer. The number stays the same.',
      'Items or shipping changed on the order: edit the order instead. When the edit adds to the bill, this invoice is cancelled and re-issued for you.',
    ],
  },
} as const
