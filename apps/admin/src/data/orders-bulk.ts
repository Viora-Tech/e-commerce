/** Copy for the orders list's More actions on selected orders, and the packing-slip print view. */
export const ordersBulkContent = {
  addTags: 'Add tags',
  removeTags: 'Remove tags',
  addTagsTitle: (n: number) => `Add tags to ${n} ${n === 1 ? 'order' : 'orders'}`,
  removeTagsTitle: (n: number) => `Remove tags from ${n} ${n === 1 ? 'order' : 'orders'}`,
  tagsDone: (n: number) => `Tags updated on ${n} ${n === 1 ? 'order' : 'orders'}`,
  remind: 'Send payment reminders',
  remindTitle: (n: number) => `Send payment reminders for ${n} ${n === 1 ? 'order' : 'orders'}?`,
  remindBody:
    'Each customer still waiting to pay by UPI or bank transfer gets an email (and WhatsApp when set up) with your payment details. Orders already paid, paid another way, or reminded in the last 6 hours are skipped.',
  remindConfirm: 'Send reminders',
  remindDone: (sent: number, skipped: number, failed: number) =>
    [
      `${sent} ${sent === 1 ? 'reminder' : 'reminders'} sent`,
      skipped > 0 ? `${skipped} skipped` : null,
      failed > 0 ? `${failed} failed` : null,
    ]
      .filter(Boolean)
      .join(', '),
  export: 'Export as CSV',
  exportDone: (n: number) => `${n} ${n === 1 ? 'order' : 'orders'} exported`,
  exportFailed: 'Could not export orders',
  print: 'Print packing slips',
  printTooMany: (max: number) => `Print up to ${max} packing slips at a time`,
  printPickList: 'Print pick list',
  printInvoices: 'Print invoices',
  csv: {
    order: 'Order',
    date: 'Date',
    customer: 'Customer',
    email: 'Email',
    phone: 'Phone',
    line1: 'Address',
    line2: 'Address line 2',
    city: 'City',
    state: 'State',
    pincode: 'PIN code',
    total: 'Total (₹)',
    payment: 'Payment',
    fulfilment: 'Fulfilment',
    status: 'Status',
    tags: 'Tags',
  },
}

/** The print view for the packing slips of the orders selected on the list. */
export const packingSlipsContent = {
  title: 'Packing slips',
  ready: (n: number) => `${n} packing ${n === 1 ? 'slip' : 'slips'} ready to print`,
  readyOrders: (n: number) => `${n} ${n === 1 ? 'order' : 'orders'} ready to print`,
  none: 'No orders to print. Pick orders on the Orders list first.',
  failed: 'Some of the selected orders could not be found, so their slips are missing.',
  print: 'Print',
  back: 'Back to orders',
}
