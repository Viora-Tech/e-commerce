/**
 * The GST invoices app's action rows (owner, 28 Nov 2026): the invoice page's "Email to buyer"
 * with Edit invoice, Print and Download PDF in its ⋯ menu, and the Invoices and Queue bulk
 * bars' ⋯ menus.
 */
export const gstInvoiceActionsContent = {
  detail: {
    email: 'Email to buyer',
    noEmail: 'This order has no email address',
    sending: 'Emailing the invoice',
    sent: (email: string) => `Invoice emailed to ${email}`,
    queued: 'Invoice is on its way to the buyer',
    failed: 'Could not email the invoice',
    more: 'More actions',
    edit: 'Edit invoice',
    editUntil: (due: string) => `Until this month's GSTR-1 is filed (due ${due})`,
  },
  bulk: {
    more: 'More actions',
  },
  /** The Queue's bulk bar: Issue N invoices, then ⋯ with these. */
  queueBulk: {
    remove: 'Remove from queue',
  },
} as const
