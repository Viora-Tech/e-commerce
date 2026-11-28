/**
 * The GST invoices app's action rows (owner, 28 Nov 2026): the invoice page's "Email to buyer"
 * with Print and Download PDF in its ⋯ menu, and the Invoices bulk bar's ⋯ menu.
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
  },
  bulk: {
    more: 'More actions',
  },
} as const
