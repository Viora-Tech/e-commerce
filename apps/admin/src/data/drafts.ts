/** Every word the draft order and abandoned checkout screens show. */

/** The drafts list's tabs after "All" (`?status=`); mirrors DRAFT_LIST_STATUSES in core. */
export const DRAFT_LIST_FILTERS = ['open', 'invoice_sent'] as const
export type DraftListFilter = (typeof DRAFT_LIST_FILTERS)[number]

export const draftsContent = {
  title: 'Draft orders',
  heading: 'Draft orders',
  intro:
    'Orders you build for a customer. They stay hidden from your storefront until you convert them.',
  tabs: { all: 'All drafts', open: 'Open', invoice_sent: 'Invoice sent' },
  viewLabel: 'Draft view',
  sortNewest: 'Newest first',
  sortOldest: 'Oldest first',
  create: 'Create draft order',
  summary: (total: number, invoiced: number) =>
    [
      `${total} ${total === 1 ? 'draft' : 'drafts'}`,
      invoiced > 0 ? `${invoiced} ${invoiced === 1 ? 'invoice' : 'invoices'} sent` : null,
    ]
      .filter(Boolean)
      .join(' · '),
  tiles: {
    open: { label: 'Open drafts', note: 'Ready to convert or send' },
    invoiced: { label: 'Invoices sent', note: 'Waiting for the customer to pay' },
    value: { label: 'Value in drafts', note: (n: number) => `Across all ${n} drafts` },
  },
  noResults: 'No drafts match that search',
  openDraft: 'Open draft',
  deleteDraft: 'Delete draft',
  deleteSelected: (n: number) => `Delete ${n} ${n === 1 ? 'draft' : 'drafts'}`,
  deleteTitle: (n: number) => (n === 1 ? 'Delete this draft?' : `Delete ${n} drafts?`),
  deleteBody: (n: number) =>
    n === 1
      ? 'The draft and its items are removed. This cannot be undone.'
      : 'The drafts and their items are removed. Orders already placed from a draft are kept. This cannot be undone.',
  deleted: (n: number) => (n === 1 ? 'Draft deleted' : `${n} drafts deleted`),
  deleteFailed: 'Could not delete the drafts',
  cancel: 'Cancel',
  resource: { singular: 'draft', plural: 'drafts' },
  search: 'Search drafts',
  empty: 'No draft orders yet',
  columns: {
    number: 'Draft',
    customer: 'Customer',
    items: 'Items',
    total: 'Total',
    created: 'Created',
    status: 'Status',
  },
  itemCount: (n: number) => (n === 1 ? '1 item' : `${n} items`),
  guest: 'No customer',
  status: { open: 'Open', invoiceSent: 'Invoice sent' },
} as const

export const draftEditorContent = {
  newTitle: 'Create draft order',
  editTitle: (n: number) => `Draft #${n}`,
  subtitle: {
    for: (name: string) => `For ${name}`,
    items: (n: number) => (n === 1 ? '1 item' : `${n} items`),
    created: (date: string) => `created ${date}`,
  },
  save: 'Save draft',
  saved: 'Draft saved',
  saveFailed: 'Could not save the draft',
  unsaved: 'Unsaved changes',
  discard: 'Discard',
  products: {
    heading: 'Products',
    search: 'Search products to add',
    searching: 'Searching',
    noResults: 'No products match that search',
    empty: 'No products yet. Search above to add the first one.',
    quantity: 'Qty',
    price: 'Price',
    remove: 'Remove',
    added: 'Added',
  },
  customer: {
    heading: 'Customer',
    search: 'Search customers by name or email',
    name: 'Name',
    email: 'Email',
    phone: 'Phone',
    clear: 'Clear customer',
    help: 'The invoice goes to this email address.',
  },
  address: {
    heading: 'Shipping address',
    name: 'Full name',
    line1: 'Address',
    line2: 'Apartment, landmark (optional)',
    city: 'City',
    state: 'State',
    pincode: 'Pincode',
    phone: 'Phone',
  },
  totals: {
    heading: 'Payment',
    subtotal: 'Subtotal',
    items: (n: number) => (n === 1 ? '1 item' : `${n} items`),
    gstIncluded: (rate: number) => `GST ${rate}% · included in the prices above`,
    discount: 'Discount',
    discountLabel: 'Discount label',
    shipping: 'Shipping',
    total: 'Total',
  },
  note: { heading: 'Note', placeholder: 'Anything the packing team should know' },
  actions: {
    heading: 'Actions',
    more: 'More actions',
    sendInvoice: 'Send invoice',
    invoiceSent: (to: string) => `Invoice sent to ${to}`,
    invoiceFailed: 'Could not send the invoice',
    convert: 'Convert to order',
    converted: 'Draft converted to an order',
    convertFailed: 'Could not convert this draft',
    delete: 'Delete draft',
    deleted: 'Draft deleted',
    deleteFailed: 'Could not delete this draft',
    deleteTitle: 'Delete this draft?',
    deleteBody: 'The draft and its items are removed. This cannot be undone.',
    cancel: 'Cancel',
    saveFirst: 'Save the draft first',
    open: 'Open',
    invoiceSentStatus: 'Invoice sent',
  },
  paymentMethod: 'Payment method',
  methods: {
    manual: 'UPI to your own ID — you confirm it',
    cod: 'Cash on delivery',
    razorpay: 'Razorpay',
  },
} as const

/** The abandoned list's tabs after "All" (`?status=`); mirrors ABANDONED_LIST_STATUSES in core. */
export const ABANDONED_LIST_FILTERS = ['not_recovered', 'reminder_sent', 'recovered'] as const
export type AbandonedListFilter = (typeof ABANDONED_LIST_FILTERS)[number]

export const abandonedContent = {
  title: 'Abandoned checkouts',
  heading: 'Abandoned checkouts',
  viewLabel: 'Checkout view',
  intro: 'Baskets where a shopper left their contact but did not pay.',
  summary: (carts: number, recovered: number, valuePaise: string) =>
    `${carts} ${carts === 1 ? 'cart' : 'carts'} left this week · ${recovered} recovered · ${valuePaise} still waiting`,
  tabs: {
    all: 'All',
    not_recovered: 'Not recovered',
    reminder_sent: 'Reminder sent',
    recovered: 'Recovered',
  },
  search: 'Search carts',
  sendReminders: 'Send reminders',
  remindersDone: (n: number) => (n === 1 ? 'Sent 1 reminder' : `Sent ${n} reminders`),
  nothingToSend: 'No carts are waiting for a reminder',
  resource: { singular: 'checkout', plural: 'checkouts' },
  empty: 'No abandoned checkouts in this period',
  tiles: {
    carts: 'Abandoned carts',
    recovered: 'Recovered',
    value: 'Value waiting',
    reminders: 'Reminders sent',
    period: 'Last 7 days',
    recoveryRate: (pct: string) => `${pct} recovery`,
  },
  columns: {
    contact: 'Customer',
    cart: 'Cart',
    value: 'Value',
    activity: 'Left',
    status: 'Recovery',
  },
  more: (n: number) => `+ ${n} more`,
  status: { open: 'Not recovered', sent: 'Reminder sent', recovered: 'Recovered' },
  anonymous: 'No contact',
  itemCount: (n: number) => (n === 1 ? '1 item' : `${n} items`),
  view: 'View checkout',
  send: 'Send recovery email',
  sending: 'Sending',
  sent: (n: number) => (n === 1 ? 'Recovery email sent' : `Recovery message sent on ${n} channels`),
  sendFailed: 'Could not send the recovery email',
  detail: {
    heading: 'Basket',
    close: 'Close',
    subtotal: 'Subtotal',
    lastSeen: 'Last activity',
    recoveryLink: 'Recovery link',
  },
} as const
