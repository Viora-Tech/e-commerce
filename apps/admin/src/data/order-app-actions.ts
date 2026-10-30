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
    queued: (added: number, skipped: number) => {
      const done =
        added === 0
          ? 'Nothing new to add to the invoice queue'
          : `Added ${added} ${added === 1 ? 'invoice' : 'invoices'} to the invoice queue`
      return skipped === 0
        ? done
        : `${done}. Skipped ${skipped} test or gift-card-only ${skipped === 1 ? 'order' : 'orders'}, which get no tax invoice.`
    },
  },
}
