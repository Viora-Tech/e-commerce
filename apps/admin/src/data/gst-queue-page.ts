/** The GST invoices Queue page and the app bar's Export GSTR-1. No em or en dashes. */

/**
 * The Queue page (Figma 928:10728): four figures, Ready and Needs fixing chips, each draft's
 * taxable value, GST and status, and Issue or Fix per row.
 */
export const gstQueuePageContent = {
  title: 'Queue',
  subtitle: {
    payment:
      'Orders waiting for an invoice. Paid orders join automatically; issue them one by one or all at once.',
    fulfilment:
      'Orders waiting for an invoice. Orders join when they ship; issue them one by one or all at once.',
    manual:
      'Orders waiting for an invoice. Add orders by number from the More menu; issue them one by one or all at once.',
  },
  stats: {
    issued: 'Issued this month',
    taxable: (amount: string) => `${amount} taxable`,
    waiting: 'Waiting',
    needHsn: (n: number) => (n === 1 ? '1 needs an HSN code' : `${n} need an HSN code`),
    needFix: (n: number) => (n === 1 ? '1 needs fixing' : `${n} need fixing`),
    allReady: 'All ready to issue',
    creditNotes: 'Credit notes',
    nextNumber: 'Next number',
    resets: (date: string) => `resets ${date}`,
    neverResets: 'one running count, never resets',
    noSeries: 'No tax invoice series',
  },
  chips: { all: 'All', ready: 'Ready', fix: 'Needs fixing' },
  columns: {
    order: 'Order',
    customer: 'Customer',
    gstin: 'GSTIN',
    taxable: 'Taxable',
    gst: 'GST',
    status: 'Status',
    action: 'Action',
  },
  statuses: {
    ready: 'Ready',
    ready_b2b: 'Ready · B2B',
    ready_export: 'Ready · Export',
    hsn_missing: 'HSN missing',
    buyer_details: 'Buyer details missing',
  },
  fixHelp: {
    hsn_missing: 'Add an HSN code to this product, or set a default HSN in settings',
    buyer_details:
      'Sales of Rs 50,000 or more to an unregistered buyer need their name, address and state. Add them on the order.',
  },
  issue: 'Issue',
  fix: 'Fix',
  issueMany: (n: number) => (n === 1 ? 'Issue 1 invoice' : `Issue ${n} invoices`),
  selectAll: 'Select every order shown',
  selectRow: (order: string) => `Select ${order}`,
  selected: (n: number) => `${n} selected`,
  more: 'More queue actions',
  addByNumber: 'Add orders by number',
  filterDates: 'Filter by date',
  removeSelected: 'Remove selected from queue',
  clearDates: 'Clear dates',
  dateRange: (from: string, to: string) => `Due ${from || '…'} to ${to || '…'}`,
  addTitle: 'Add orders to the queue',
  addBody: 'Type order numbers separated by commas or spaces, e.g. 1042, 1043.',
  addField: 'Order numbers',
  datesTitle: 'Show orders due between',
  apply: 'Apply',
  noneReady: 'Nothing is ready to issue yet. Fix the rows marked in amber first.',
  noneToFix: 'Nothing needs fixing. Every waiting order can be issued.',
  /** An empty cell or figure. */
  none: '-',
  statsFailed: 'Could not load this month’s figures',
} as const

/** The app bar's "Export GSTR-1": the portal JSON for a month of the main GST number. */
export const gstExportContent = {
  label: 'Export GSTR-1',
  month: (label: string) => `GSTR-1 JSON, ${label}`,
  thisMonth: (label: string) => `GSTR-1 JSON, ${label} so far`,
  returns: 'All returns and downloads',
  failed: 'Could not export GSTR-1',
} as const
