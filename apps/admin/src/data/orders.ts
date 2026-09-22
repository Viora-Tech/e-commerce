export const ORDER_STATUSES = ['placed', 'paid', 'fulfilled', 'delivered', 'cancelled'] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

/** Copy for the orders list and shared order labels. */
export const ordersContent = {
  title: 'Orders',
  /* Frame 5:2353: "Order List" heading, Add Order + More Action, four tiles, tab group. */
  heading: 'Order list',
  addOrder: 'Add order',
  moreActions: 'More actions',
  menu: { drafts: 'Draft orders', abandoned: 'Abandoned checkouts' },
  export: 'Export',
  resource: { singular: 'order', plural: 'orders' },
  tiles: {
    total: 'Total orders',
    placed: 'New orders',
    delivered: 'Completed orders',
    cancelled: 'Cancelled orders',
    period: 'Last 7 days',
  },
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

/** Badge tone per order status. */
export const ORDER_STATUS_TONE: Record<
  OrderStatus,
  'warning' | 'info' | 'success' | 'destructive' | 'neutral'
> = {
  placed: 'warning',
  paid: 'info',
  fulfilled: 'success',
  delivered: 'success',
  cancelled: 'destructive',
}

/** Copy for the order detail page. */
export const orderDetailContent = {
  back: 'Orders',
  title: (n: number) => `Order #${n}`,
  placed: (when: string) => `Placed ${when}`,
  actions: {
    markPaid: 'Mark as paid',
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
      pending: 'Payment pending',
      captured: 'Paid',
      refunded: 'Refunded',
      failed: 'Payment failed',
    },
    partiallyRefunded: 'Partially refunded',
    fulfilment: { unfulfilled: 'Unfulfilled', fulfilled: 'Fulfilled', delivered: 'Delivered' },
  },
  items: {
    heading: 'Items',
    sku: 'SKU',
    subtotal: 'Subtotal',
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
    address: 'Shipping address',
    noAddress: 'No address on file',
    billingSame: 'Billing address is the same as shipping',
    view: 'View customer',
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
