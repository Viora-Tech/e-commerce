/** Every word the draft order and abandoned checkout screens show. */

/**
 * The drafts list's tabs after "All" (`?status=`): who made it (`checkout`, `staff`; DRAFT_SOURCES
 * in core), then a staff draft's state (DRAFT_LIST_STATUSES in core).
 */
export const DRAFT_LIST_FILTERS = ['checkout', 'staff', 'open', 'invoice_sent'] as const
export type DraftListFilter = (typeof DRAFT_LIST_FILTERS)[number]

export const draftsContent = {
  title: 'Draft orders',
  heading: 'Draft orders',
  intro:
    'Orders you build for a customer. They stay hidden from your storefront until you convert them.',
  tabs: {
    all: 'All drafts',
    checkout: 'From checkout (unpaid)',
    staff: 'Created by staff',
    open: 'Open',
    invoice_sent: 'Invoice sent',
  },
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
    checkout: { label: 'Unpaid checkouts', note: 'Shoppers who have not paid yet' },
    invoiced: { label: 'Invoices sent', note: 'Waiting for the customer to pay' },
    value: { label: 'Value in drafts', note: (n: number) => `Across all ${n} drafts` },
  },
  noResults: 'No drafts match that search',
  openDraft: 'Open draft',
  deleteDraft: 'Delete draft',
  deleteSelected: (n: number) => `Delete ${n} ${n === 1 ? 'draft' : 'drafts'}`,
  sendInvoice: 'Send invoice',
  resendInvoice: 'Send invoice again',
  sendSelected: (n: number) => `Send ${n} ${n === 1 ? 'invoice' : 'invoices'}`,
  sendTitle: (n: number) => `Send ${n} ${n === 1 ? 'invoice' : 'invoices'}?`,
  sendBody:
    'Each customer gets their own invoice by email. Drafts without an email address are skipped.',
  sendConfirm: 'Send invoices',
  sentMany: (sent: number, skipped: number) =>
    `${sent} ${sent === 1 ? 'invoice' : 'invoices'} sent${skipped ? `, ${skipped} skipped (no email)` : ''}`,
  sendFailed: 'Could not send the invoices. Try again.',
  invoiceSentOne: (to: string) => `Invoice sent to ${to}`,
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
    activity: 'Last activity',
    status: 'Status',
  },
  itemCount: (n: number) => (n === 1 ? '1 item' : `${n} items`),
  guest: 'No customer',
  status: {
    open: 'Open',
    invoiceSent: 'Invoice sent',
    unpaid: 'Unpaid',
    failed: (n: number) => (n > 1 ? `Payment failed ×${n}` : 'Payment failed'),
    refundNeeded: 'Refund needed',
    shopperPaid: 'Shopper says paid',
    expired: 'Expired',
  },
} as const

/** A shopper's unpaid checkout kept as a draft (#D57) until it is paid. */
export const checkoutDraftContent = {
  badge: 'Unpaid checkout',
  intro:
    'A shopper checked out but has not paid yet. It becomes an order, with an order number, when the payment arrives or when you mark it paid.',
  summary: 'Checkout',
  method: 'Payment method',
  methods: { manual: 'UPI or bank transfer', online: 'Online payment' } as Record<string, string>,
  lastActivity: 'Last activity',
  held: 'Items held until',
  notHeld: 'Items are not held. Paying reserves them again if they are in stock.',
  expired: 'This checkout stopped waiting for payment after 7 days without activity.',
  refundNeeded:
    'A payment arrived but the items were out of stock, so no order was placed. Refund the payment to the shopper.',
  attempts: 'Payment attempts',
  attempt: (n: number) => `Attempt ${n}`,
  noAttempts: 'No payment attempts yet',
  attemptStatus: {
    created: 'Not started',
    pending: 'Waiting for the shopper',
    authorized: 'Authorised',
    captured: 'Paid',
    failed: 'Failed',
    cancelled: 'Replaced',
    refunded: 'Refunded',
  } as Record<string, string>,
  items: 'Items',
  total: 'Total',
  contact: 'Contact',
  timeline: 'Timeline',
  payLink: 'Copy payment link',
  payLinkCopied: 'Payment link copied',
  /** "Send payment link": the review dialog's title and button, then the toasts. */
  sendLink: 'Send payment link',
  sendLinkButton: 'Send link',
  linkSent: {
    email: 'Payment link sent by email',
    whatsapp: 'Payment link sent on WhatsApp',
    both: 'Payment link sent by email and WhatsApp',
  },
  /** The 10-minute limit per channel; `minutes` until it may go again. */
  linkTooSoon: (channel: 'email' | 'whatsapp', minutes: number) =>
    `The payment link already went ${channel === 'email' ? 'by email' : 'on WhatsApp'} a moment ago. You can send it again in ${minutes === 1 ? '1 minute' : `${minutes} minutes`}.`,
  markPaid: 'Mark as paid',
  markPaidTitle: 'Mark this checkout as paid?',
  markPaidBody: (total: string) =>
    `Only when you have received ${total}. It becomes an order with the next order number and the shopper gets their confirmation.`,
  convert: 'Convert to order (unpaid)',
  convertTitle: 'Convert to an unpaid order?',
  convertBody:
    'It becomes an order with the next order number, still waiting for payment, for example to ship on trust. Its stock is held for the order.',
  converted: (n: number) => `Order #${n} created`,
  failedAction: 'Could not do that. Try again.',
  deleteDraft: 'Delete',
  cancel: 'Cancel',
} as const

export const draftEditorContent = {
  newTitle: 'Create draft order',
  /** A variant listed without a price yet (#913): the line starts at ₹0 for you to type one. */
  noPrice: 'No price yet',
  /** `ref` is the draft's number after the #: "D12". */
  editTitle: (ref: string) => `Draft #${ref}`,
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
    browse: 'Browse',
    addCustom: 'Add custom item',
    customLabel: 'Custom item',
    noGst: 'No GST',
    empty: 'No products yet. Browse your catalogue or add a custom item.',
    quantity: 'Qty',
    price: 'Price',
    remove: 'Remove',
    added: 'Added',
  },
  /** "Add custom item" (audit #28): a one-off line that is not in the catalogue. */
  customItem: {
    title: 'Add custom item',
    name: 'Item name',
    price: 'Price',
    quantity: 'Quantity',
    taxable: 'Charge GST on this item',
    taxableHelp: 'At your store’s default GST rate. Turn off for an exempt item.',
    hsCode: 'HSN code (optional)',
    add: 'Add item',
    cancel: 'Cancel',
    errors: {
      title: 'Give the item a name',
      price: 'Enter a price',
      quantity: 'Quantity must be 1 to 999',
      hsCode: 'HSN codes are 4, 6 or 8 digits',
    },
  },
  customer: {
    heading: 'Customer',
    search: 'Search customers by name or email',
    name: 'Name',
    email: 'Email',
    phone: 'Phone',
    clear: 'Clear customer',
    help: 'The invoice goes to this email address.',
    matched: (name: string) => `Saved customer found: filled in ${name}'s details`,
  },
  address: {
    heading: 'Shipping address',
    name: 'Full name',
    line1: 'Address',
    line2: 'Apartment, landmark (optional)',
    city: 'City',
    state: 'State',
    statePlaceholder: 'Select state',
    pincode: 'Pincode',
    phone: 'Phone',
  },
  billing: {
    heading: 'Billing address',
    same: 'Billing address is the same as shipping',
    businessName: 'Company name (optional)',
    gstin: 'GSTIN (optional)',
    gstinHelp: 'Printed on the GST invoice. Leave blank when billing a person.',
    gstinInvalid: 'Check the GSTIN: 15 characters, like 06AAACW1234A1Z5',
  },
  totals: {
    heading: 'Payment',
    subtotal: 'Subtotal',
    items: (n: number) => (n === 1 ? '1 item' : `${n} items`),
    gstEstimated: (rate: number | null) =>
      rate === null ? 'GST (estimated)' : `GST ${rate}% (estimated)`,
    gstIncluded: 'Included in the prices',
    discount: 'Discount',
    discountLabel: 'Discount label',
    shipping: 'Shipping',
    addDiscount: 'Add discount',
    addShipping: 'Add shipping',
    edit: (what: string) => `Edit ${what.toLowerCase()}`,
    remove: (what: string) => `Remove ${what.toLowerCase()}`,
    discountDialog: {
      title: 'Add discount',
      editTitle: 'Edit discount',
      code: 'Discount code',
      manual: 'Amount off',
      amount: 'Amount',
      reason: 'Reason (optional)',
      reasonHelp: 'Shown to the customer on the invoice, e.g. "Loyal customer".',
      apply: 'Apply',
      cancel: 'Cancel',
    },
    shippingDialog: {
      title: 'Shipping',
      amount: 'Shipping charge',
      help: 'What the customer pays for delivery. Leave 0 for free shipping.',
      apply: 'Apply',
      cancel: 'Cancel',
    },
    total: 'Total',
    code: {
      label: 'Discount code',
      placeholder: 'Enter a store discount code',
      apply: 'Apply',
      remove: 'Remove code',
      help: 'Checked like checkout: dates, minimums, products, customer and usage limits. A code replaces the manual discount.',
      off: (amount: string) => `${amount} off`,
      freeShipping: 'Free shipping',
      failed: 'Could not check the code',
      stale: 'This code no longer applies to the draft:',
      rejected: {
        invalid: 'This code does not exist or is not active.',
        not_applicable: 'This code does not apply to these products.',
        min_subtotal: 'The order is below the minimum for this code.',
        min_quantity: 'The order has fewer items than this code needs.',
        not_eligible: 'This customer is not eligible for this code.',
        first_order_only:
          'This code is for first-time buyers, and this customer has ordered before.',
        limit_reached: 'This code has reached its usage limit.',
      },
    },
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
    needsAddress: 'Add a shipping address before converting',
    needsAddressParts: (parts: string) => `Shipping address still needs: ${parts}`,
    needsBilling: "Complete the billing address, or tick 'same as shipping'",
    open: 'Open',
    invoiceSentStatus: 'Invoice sent',
  },
  paymentMethod: 'Payment method',
  methods: {
    manual: 'UPI to your own ID — you confirm it',
    cod: 'Cash on delivery',
    razorpay: 'Razorpay',
  },
  /** "Payment due later" (#1029). Keys match PAYMENT_TERMS in core; '' = paid now. */
  terms: {
    label: 'When it is paid',
    options: {
      '': 'Paid now',
      receipt: 'Due on receipt',
      fulfillment: 'Due on fulfilment',
      net_7: 'Within 7 days',
      net_15: 'Within 15 days',
      net_30: 'Within 30 days',
      net_45: 'Within 45 days',
      net_60: 'Within 60 days',
      net_90: 'Within 90 days',
      fixed: 'On a date',
    },
    dueDate: 'Due date',
    help: 'The order is placed now and marked unpaid. Record the payment on the order when it comes in.',
    needsDate: 'Pick the date payment is due',
  },
  /** "Reserve items" (#1030). */
  hold: {
    heading: 'Reserve items',
    body: "Hold this draft's stock so no one else can buy it. Prices on a draft stay as saved.",
    until: 'Hold until',
    reserve: 'Reserve items',
    release: 'Release',
    heldUntil: (date: string) => `Items held until ${date}`,
    reserved: 'Items reserved',
    released: 'Items released',
    failed: 'Could not reserve the items',
    saveFirst: 'Save the draft first',
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

/** The abandoned checkouts list's bulk "Send recovery" for the selected carts. */
export const abandonedBulkContent = {
  send: (n: number) => `Send recovery to ${n}`,
  title: (n: number) => `Send recovery messages to ${n} ${n === 1 ? 'shopper' : 'shoppers'}?`,
  body: 'Each shopper gets your recovery email (and WhatsApp when set up) with a link back to their cart. Checkouts already recovered or without an email are skipped, and so are shoppers who have not agreed to marketing messages.',
  confirm: 'Send recovery',
  done: (sent: number, skipped: number, noConsent: number, failed: number) =>
    [
      sent === 1 ? 'Sent 1 recovery message' : `Sent ${sent} recovery messages`,
      skipped > 0 ? `${skipped} skipped` : null,
      noConsent > 0 ? `${noConsent} without marketing consent` : null,
      failed > 0 ? `${failed} failed` : null,
    ]
      .filter(Boolean)
      .join(', '),
}
