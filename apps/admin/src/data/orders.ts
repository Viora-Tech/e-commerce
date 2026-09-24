export const ORDER_STATUSES = ['placed', 'paid', 'fulfilled', 'delivered', 'cancelled'] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

/** 1st, 2nd, 3rd, 4th — for "3rd order" on the customer card. */
function ordinal(n: number): string {
  const rest = n % 100
  if (rest >= 11 && rest <= 13) return `${n}th`
  const last = n % 10
  if (last === 1) return `${n}st`
  if (last === 2) return `${n}nd`
  if (last === 3) return `${n}rd`
  return `${n}th`
}

/** Copy for the orders list and shared order labels. */
export const ordersContent = {
  row: {
    openNewTab: 'Open in a new tab',
    open: 'Open order',
    sameCustomer: 'Orders from this customer',
  },
  title: 'Orders',
  /* Frame 5:2353: "Order List" heading, Add Order + More Action, four tiles, tab group. */
  heading: 'Order list',
  addOrder: 'Add order',
  moreActions: 'More actions',
  menu: { drafts: 'Draft orders', abandoned: 'Abandoned checkouts' },
  export: 'Export',
  resource: { singular: 'order', plural: 'orders' },
  tabs: {
    all: 'All orders',
  },
  status: {
    placed: 'Placed',
    paid: 'Paid',
    fulfilled: 'Fulfilled',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
  } satisfies Record<OrderStatus, string>,
  payment: {
    codPending: 'Unpaid',
    cod: 'COD',
    paid: 'Paid',
  },
  guest: 'Guest',
  columns: {
    order: 'Order id',
    product: 'Product',
    date: 'Date',
    customer: 'Customer',
    total: 'Price',
    payment: 'Payment',
    status: 'Status',
  },
  moreLines: (n: number) => `+${n} more`,
  bulk: {
    markAs: 'Mark as',
    updated: (n: number, status: string) => `${n} marked ${status.toLowerCase()}`,
    failed: 'Could not update orders',
  },
  empty: {
    heading: 'No orders yet',
    body: 'Orders appear here as soon as a customer checks out.',
  },
} as const

/** Copy for the order detail page. */
export const orderDetailContent = {
  back: 'Orders',
  title: (n: number) => `Order #${n}`,
  placed: (when: string) => `Placed ${when}`,
  paidVia: 'Payment',
  previous: 'Previous order',
  next: 'Next order',
  actions: {
    markPaid: 'Mark as paid',
    fulfilItems: 'Fulfil items',
    collect: 'Collect payment',
    fulfil: 'Mark as fulfilled',
    deliver: 'Mark as delivered',
    cancel: 'Cancel order',
    refund: 'Refund',
    print: 'Print packing slip',
    more: 'More actions',
  },
  moved: (status: string) => `Order marked as ${status}`,
  cancelDialog: {
    title: 'Cancel this order?',
    body: 'The shopper will no longer be able to pay for it and any booked shipment should be cancelled separately. This cannot be undone.',
    confirm: 'Cancel order',
    keep: 'Keep order',
  },
  refundDialog: {
    title: 'Refund payment',
    body: (remaining: string) => `Up to ${remaining} can be refunded on this payment.`,
    amount: 'Amount (₹)',
    reason: 'Reason',
    reasonPlaceholder: 'Damaged in transit, size exchange…',
    manualNote:
      'This method is settled outside the platform. Refund the shopper yourself and record it here.',
    confirm: 'Refund',
    close: 'Close',
    full: 'Refund remaining',
    done: (amount: string) => `Refunded ${amount}`,
    failed: 'Refund failed',
  },
  pills: {
    payment: {
      created: 'Payment pending',
      pending: 'Payment pending',
      authorized: 'Authorised',
      captured: 'Paid',
      refunded: 'Refunded',
      failed: 'Payment failed',
      cancelled: 'Payment cancelled',
      refundNeeded: 'Refund needed',
    },
    partiallyRefunded: 'Partially refunded',
    fulfilment: { unfulfilled: 'Unfulfilled', fulfilled: 'Fulfilled', delivered: 'Delivered' },
  },
  unfulfilled: {
    heading: 'Unfulfilled',
    fulfilled: 'Fulfilled',
    ofQuantity: (done: number, total: number) => `${done} of ${total} packed`,
    waybill: 'Tracking',
  },
  fulfilDialog: {
    title: 'Fulfil items',
    body: 'Pick what is going out now. The shopper is told once everything on the order has been packed.',
    quantity: 'Quantity',
    courier: 'Courier',
    courierPlaceholder: 'Delhivery, Blue Dart, hand delivery…',
    tracking: 'Tracking number',
    trackingPlaceholder: 'Optional',
    trackingUrl: 'Tracking link',
    confirm: 'Fulfil items',
    cancel: 'Cancel',
    done: 'Items marked as fulfilled',
    failed: 'Could not fulfil those items',
    nothing: 'Nothing left to pack.',
  },
  collectDialog: {
    title: 'Collect payment',
    body: (amount: string) =>
      `Record ${amount} received outside the gateway, for example cash on delivery or a bank transfer you matched by hand.`,
    amount: 'Amount (₹)',
    confirm: 'Mark as paid',
    cancel: 'Cancel',
    done: 'Payment recorded',
    failed: 'Could not record that payment',
    openPayPage: 'Open pay page',
    gatewayNote:
      'This order is on a gateway: send the shopper back to the pay page instead of recording it here.',
  },
  items: {
    heading: 'Items',
    sku: 'SKU',
    columns: {
      product: 'Product',
      sku: 'SKU',
      variant: 'Variant',
      quantity: 'Quantity',
      price: 'Price',
      total: 'Total',
      actions: 'Actions',
    },
    summary: 'Order summary',
    openProduct: 'Open product in a new tab',
    viewProduct: 'View product',
    stockForSku: 'Stock for this SKU',
    paymentSummary: 'Payment summary',
    groups: (n: number) => `${n} fulfilment ${n === 1 ? 'group' : 'groups'}`,
    subtotal: 'Subtotal',
    tax: 'Tax',
    cgst: (rate: number) => `CGST ${rate / 2}%`,
    sgst: (rate: number) => `SGST ${rate / 2}%`,
    igst: (rate: number) => `IGST ${rate}%`,
    taxIncluded: 'included in the prices above',
    paidByCustomer: 'Paid by customer',
    balance: 'Balance',
    balanceOwed: 'Balance due',
    shipping: 'Shipping',
    fee: 'Payment fee',
    discount: 'Payment discount',
    orderDiscount: 'Discount',
    total: 'Total',
    refunded: 'Refunded',
    net: 'Net paid',
  },
  payment: {
    heading: 'Payment',
    method: { cod: 'Cash on delivery', manual: 'UPI / bank transfer' } as Record<string, string>,
    reference: 'Reference',
    gatewayId: 'Gateway payment id',
    captured: 'Captured',
    authorised: 'Authorised, not yet captured',
    attempt: (n: number) => `Attempt ${n}`,
    amount: 'Amount',
    refundNeeded:
      'Money was captured after this order was cancelled or already paid. Refund it to the shopper.',
    awaiting: 'Awaiting collection',
    refundedTotal: 'Refunded',
    events: 'Gateway events',
    noEvents: 'No gateway events yet.',
    refunds: 'Refunds',
    refundStatus: {
      pending: 'Pending at gateway',
      processed: 'Processed',
      failed: 'Failed',
      manual: 'Recorded manually',
    } as Record<string, string>,
  },
  timeline: {
    heading: 'Timeline',
    today: 'Today',
    placed: 'Order placed',
    paymentCaptured: 'Payment captured',
    paymentEvent: (type: string) => `Gateway: ${type}`,
    refund: (amount: string) => `Refund of ${amount}`,
    notification: (template: string, channel: string) => `${template} sent via ${channel}`,
    notificationFailed: (template: string, channel: string) => `${template} via ${channel} failed`,
    shipmentBooked: 'Shipment booked',
    shipment: (status: string) => `Shipment: ${status}`,
    note: 'Note',
    addNote: 'Add note',
    notePlaceholder: 'Leave a note for your team…',
    noteAdded: 'Note added',
    templates: {
      order_placed: 'Order confirmation',
      payment_received: 'Payment receipt',
      order_shipped: 'Shipping update',
    } as Record<string, string>,
  },
  customer: {
    heading: 'Customer',
    guest: 'Guest checkout',
    contact: 'Contact',
    orderCount: (n: number) => (n === 1 ? 'First order' : `${ordinal(n)} order`),
    copy: (what: string) => `Copy ${what}`,
    copied: (what: string) => `${what} copied`,
    email: 'Email',
    phone: 'Phone',
    addressLabel: 'Address',
    address: 'Shipping address',
    noAddress: 'No address on file',
    billingSame: 'Billing address is the same as shipping',
    view: 'View customer',
    heading2: 'Customer details',
    viewOrders: 'View orders',
    viewProfile: 'View profile',
    edit: 'Edit',
    editHint: 'Edit the address in the customer profile',
    billing: 'Billing address',
  },
  tags: {
    heading: 'Tags',
    placeholder: 'Add a tag and press Enter',
    saved: 'Tags saved',
  },
  print: {
    title: 'Packing slip',
    shipTo: 'Ship to',
    qty: 'Qty',
  },
} as const

/** Sub-sections under Orders that have no records yet. */
const IMPORTED_STATUS: Record<string, string> = {
  paid: 'Paid',
  pending: 'Payment pending',
  authorized: 'Authorized',
  partially_paid: 'Partially paid',
  partially_refunded: 'Partially refunded',
  refunded: 'Refunded',
  voided: 'Voided',
  expired: 'Expired',
  fulfilled: 'Fulfilled',
  unfulfilled: 'Unfulfilled',
  partial: 'Partially fulfilled',
  partially_fulfilled: 'Partially fulfilled',
  restocked: 'Restocked',
  on_hold: 'On hold',
  scheduled: 'Scheduled',
}

const PLATFORMS: Record<string, string> = { shopify: 'Shopify' }

/** The card on an order brought over from another platform. */
export const importedOrderContent = {
  title: (platform: string) => `Imported from ${PLATFORMS[platform] ?? platform}`,
  body: 'A historical order kept as a record. It did not change stock, send messages or create invoices, and it cannot be fulfilled or refunded here.',
  name: 'Original order',
  financial: 'Payment status',
  fulfillment: 'Fulfilment status',
  payment: 'Payment method',
  cancelled: 'Cancelled',
  status: (value: string | null | undefined) =>
    value ? (IMPORTED_STATUS[value.toLowerCase()] ?? value) : 'Not recorded',
}

export const ordersSectionsContent = {
  drafts: {
    heading: 'No draft orders',
    body: 'Drafts let you build an order for a customer over the phone or WhatsApp and send them a link to pay.',
    action: { label: 'View orders', href: '/orders' },
  },
  abandoned: {
    heading: 'No abandoned checkouts',
    body: 'When a shopper enters their details but leaves before paying, the checkout lands here so you can follow up.',
    action: { label: 'View orders', href: '/orders' },
  },
} as const
