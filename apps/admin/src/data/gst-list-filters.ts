/**
 * Search, filters and sort on the GST invoices Queue and Invoices lists (owner 23 Nov 2026).
 * No em or en dashes.
 */
export const gstListFiltersContent = {
  /** The shared table's names: "Search and filter queued orders", "Loading invoices". */
  queueResource: { singular: 'queued order', plural: 'queued orders' },
  invoiceResource: { singular: 'document', plural: 'documents' },
  /** The Date presets in both lists. */
  presets: {
    this_month: 'This month',
    last_month: 'Last month',
    '7d': 'Last 7 days',
    '30d': 'Last 30 days',
    '90d': 'Last 90 days',
  },
  filters: {
    /** The Queue's date: when the order became due for an invoice. */
    due: 'Order date',
    invoiceDate: 'Invoice date',
    gstin: 'GST number',
    gstOption: (state: string, gstin: string) => (state ? `${state}, ${gstin}` : gstin),
    anyGstin: 'Any GST number',
    payment: 'Payment',
    payments: { prepaid: 'Prepaid', cod: 'Cash on delivery' },
    anyPayment: 'Any payment',
    source: 'Source',
    sources: { koomerce: 'Issued here', external: 'Recorded outside' },
    anySource: 'Any source',
    status: 'Status',
    statuses: { issued: 'Issued', cancelled: 'Cancelled' },
    anyStatus: 'Any status',
  },
  sort: {
    /** The Queue's Order column sorts by order number. */
    orderNumber: 'Order number',
    dueDate: 'Order date',
    invoiceNumber: 'Invoice number',
    invoiceDate: 'Invoice date',
    amount: 'Amount',
    oldest: { asc: 'Oldest first', desc: 'Newest first' },
    lowest: { asc: 'Lowest first', desc: 'Highest first' },
  },
  /** The Queue's date column: when the order became due. */
  dateColumn: 'Date',
  /** The Queue's bulk bar while rows are ticked. */
  issueSelected: (n: number) => (n === 1 ? 'Issue 1 invoice' : `Issue ${n} invoices`),
  /** Ticked rows that still need fixing are left out of an issue. */
  noneReadySelected: 'None of the ticked orders is ready to issue',
} as const
