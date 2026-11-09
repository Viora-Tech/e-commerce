/** Actions installed apps add to orders (More actions, the row menu, the bulk bar). */
export const orderAppActionsContent = {
  /** The order page's own Create shipment, for an order that is ready to ship. */
  createShipment: 'Create shipment',
  /** The bulk bar's menu of app actions for the selected orders. */
  bulkMenu: 'More actions',
  failed: 'That did not work. Try again.',
  gst: {
    issued: (numbers: string[]) =>
      numbers.length === 1
        ? `Issued GST invoice ${numbers[0]}`
        : `Issued ${numbers.length} GST invoices: ${numbers.join(', ')}`,
    alreadyIssued: (numbers: string[]) => `Already invoiced: ${numbers.join(', ')}`,
    nothingIssued: 'No invoice was issued for this order.',
    /** The toast's buttons after an invoice was issued or queued (issue 1009). */
    view: 'View',
    download: 'Download',
    viewAll: 'View invoices',
    openQueue: 'Open queue',
    /** Bulk "Add to invoice queue": every selected order is accounted for. */
    queued: (c: {
      added: number
      skipped: number
      alreadyQueued: number
      alreadyInvoiced: number
    }) => {
      const orders = (n: number) => `${n} ${n === 1 ? 'order' : 'orders'}`
      const parts = [
        c.added === 0
          ? 'Nothing new to add to the invoice queue'
          : `Added ${c.added} ${c.added === 1 ? 'invoice' : 'invoices'} to the invoice queue`,
      ]
      if (c.alreadyQueued) parts.push(`${orders(c.alreadyQueued)} already in the queue`)
      if (c.alreadyInvoiced) parts.push(`${orders(c.alreadyInvoiced)} already invoiced`)
      if (c.skipped) {
        parts.push(
          `Skipped ${orders(c.skipped)}: test, cancelled and gift-card-only orders get no tax invoice`,
        )
      }
      return `${parts.join('. ')}.`
    },
  },
}
