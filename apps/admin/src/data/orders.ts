import type {
  OrderFulfillmentStatus,
  OrderLifecycleStatus,
  OrderMark,
  OrderPaymentStatus,
  OrderStatus,
} from '@commerce/core/order-status'
import type {
  DateFilter,
  FulfilmentFilter,
  MethodFilter,
  PaymentFilter,
} from '@/lib/order-list-filters'

/** The order moves live in core (`ORDER_MARKS`); re-exported for the admin's order screens. */
export { ORDER_MARKS, type OrderMark } from '@commerce/core/order-status'
export type { OrderFulfillmentStatus, OrderPaymentStatus, OrderStatus }

/** What "Mark as" records, on the detail page and in the list's bulk menu. */

/** Open manual UPI / bank transfer orders, waiting for the merchant to mark them paid. */
export const PENDING_UPI = 'pending_upi'
/** The Orders list's tabs after "All" (`?status=`), in the order a merchant works them. */
export const ORDER_LIST_FILTERS = [
  'unpaid',
  'unfulfilled',
  PENDING_UPI,
  'completed',
  'cancelled',
] as const
export type OrderListFilter = (typeof ORDER_LIST_FILTERS)[number]

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
  /** The plain-language line under the page title: counts only, zeros left out. */
  summary: (total: number, toShip: number, pendingUpi: number) =>
    [
      `${total} ${total === 1 ? 'order' : 'orders'}`,
      toShip > 0 ? `${toShip} need shipping` : null,
      pendingUpi > 0
        ? `${pendingUpi} UPI ${pendingUpi === 1 ? 'payment' : 'payments'} pending`
        : null,
    ]
      .filter(Boolean)
      .join(' · '),
  /** The four stat cards above the list. */
  tiles: {
    newToday: { label: 'New orders today', trendNote: 'vs yesterday' },
    ready: { label: 'Ready to ship', note: 'Paid and waiting on a courier' },
    pendingUpi: { label: 'Pending UPI', note: 'Awaiting the transfer' },
    sales: { label: 'Sales this week', trendNote: 'vs last week' },
  },
  noResults: { heading: 'No orders match', body: 'Try another search, or clear the filters.' },
  loadFailed: 'Could not load orders',
  addOrder: 'Add order',
  moreActions: 'More actions',
  menu: { drafts: 'Draft orders', abandoned: 'Abandoned checkouts', returns: 'Returns' },
  export: 'Export',
  resource: { singular: 'order', plural: 'orders' },
  /** The table's View select (Figma "Table / View select"). */
  viewLabel: 'Order view',
  /** Status column for a paid order nobody has shipped yet (Figma: blue "To ship"). */
  toShip: 'To ship',
  /** The sort menu's direction labels for the Date column (Figma "State · Sort open"). */
  sortNewest: 'Newest first',
  sortOldest: 'Oldest first',
  /** The View select while filters are applied (Figma "Custom"). */
  customView: 'Custom',
  /** The filter panel and its chips (Figma "Orders · Filter", "Applied filters"). */
  filters: {
    payment: 'Payment',
    fulfilment: 'Fulfilment',
    date: 'Date',
    anyDate: 'Any date',
    method: 'Payment method',
    show: (n: number) => `Show ${n} ${n === 1 ? 'order' : 'orders'}`,
    paymentOptions: {
      paid: 'Paid',
      unpaid: 'Unpaid',
      partially_refunded: 'Partially refunded',
      refund_needed: 'Refund needed',
    } satisfies Record<PaymentFilter, string>,
    fulfilmentOptions: {
      unfulfilled: 'Unfulfilled',
      shipped: 'Shipped',
      delivered: 'Delivered',
      returned: 'Returned',
    } satisfies Record<FulfilmentFilter, string>,
    dateOptions: {
      today: 'Today',
      '7d': 'Last 7 days',
      '30d': 'Last 30 days',
      '90d': 'Last 90 days',
    } satisfies Record<DateFilter, string>,
    methodOptions: { cod: 'Cash on delivery', prepaid: 'Prepaid' } satisfies Record<
      MethodFilter,
      string
    >,
  },
  tabs: {
    all: 'All orders',
    unpaid: 'Unpaid',
    unfulfilled: 'Unfulfilled',
    pending_upi: 'Pending UPI',
    completed: 'Completed',
    cancelled: 'Cancelled',
  } satisfies Record<OrderListFilter | 'all', string>,
  status: {
    draft: 'Draft',
    open: 'Open',
    completed: 'Completed',
    cancelled: 'Cancelled',
  } satisfies Record<OrderLifecycleStatus, string>,
  paymentStatus: {
    unpaid: 'Unpaid',
    authorized: 'Authorised',
    partially_paid: 'Partially paid',
    paid: 'Paid',
    partially_refunded: 'Partially refunded',
    refunded: 'Refunded',
    refund_needed: 'Refund needed',
  } satisfies Record<OrderPaymentStatus, string>,
  fulfillmentStatus: {
    unfulfilled: 'Unfulfilled',
    partially_fulfilled: 'Partially fulfilled',
    fulfilled: 'Fulfilled',
    shipped: 'Shipped',
    partially_delivered: 'Partially delivered',
    delivered: 'Delivered',
    returned: 'Returned',
  } satisfies Record<OrderFulfillmentStatus, string>,
  /** "Mark as …" choices. */
  marks: {
    paid: 'Paid',
    fulfilled: 'Fulfilled',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
  } satisfies Record<OrderMark, string>,
  guest: 'Guest',
  columns: {
    order: 'Order',
    product: 'Product',
    date: 'Date',
    customer: 'Customer',
    total: 'Total',
    payment: 'Payment',
    fulfilment: 'Fulfilment',
    status: 'Status',
    channel: 'Channel',
    tags: 'Tags',
  },
  /** The sort menu's names where they differ from the header (Figma "State · Sort open"). */
  sortTitles: {
    order: 'Order number',
    customer: 'Customer name',
    payment: 'Payment status',
    fulfilment: 'Fulfilment status',
  },
  moreLines: (n: number) => `+${n} more`,
  bulk: {
    markAs: 'Mark as',
    bulkEdit: 'Bulk edit',
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
    printShort: 'Print',
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
  },
  unfulfilled: {
    heading: 'Unfulfilled',
    fulfilled: 'Fulfilled',
    ofQuantity: (done: number, total: number) => `${done} of ${total} packed`,
    itemsCount: (n: number) => `${n} ${n === 1 ? 'item' : 'items'}`,
    waybill: 'Tracking',
  },
  fulfilDialog: {
    title: 'Fulfil items',
    body: 'Pick what is going out now. The shopper is told once everything on the order has been packed.',
    quantity: 'Quantity',
    courier: 'Courier',
    courierPlaceholder: 'Delhivery, Blue Dart, hand delivery…',
    tracking: 'Tracking number',
    trackingPlaceholder: 'Paste or type it, optional',
    trackingUrl: 'Tracking link',
    courierSearch: 'Search couriers',
    courierNone: 'No courier by that name',
    detected: (courier: string) => `Looks like ${courier}. Change it below if not.`,
    couldBe: 'Could be',
    otherName: 'Courier name',
    otherNamePlaceholder: 'Hand delivery, local courier…',
    openTracking: 'Check the tracking link',
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
    how: 'How were you paid?',
    methods: {
      upi: 'UPI',
      bank_transfer: 'Bank transfer (NEFT, IMPS, RTGS)',
      cash: 'Cash',
      cheque: 'Cheque',
      other: 'Other',
    },
    reference: 'UTR or reference (optional)',
    referenceHint:
      'The number on your bank statement or UPI app, so you can find this payment later.',
    referencePlaceholder: {
      upi: 'UPI reference, 12 digits',
      bank_transfer: 'UTR number',
      cash: 'Receipt number',
      cheque: 'Cheque number',
      other: 'Any note',
    },
    receivedOn: 'Date received',
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
    /** The GST number the order is billed from: its warehouse's state decides CGST + SGST or IGST. */
    billedFrom: 'Billed from',
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
    /** The gateway transactions card (the money side is the Payment card above it). */
    transactions: 'Transactions',
    method: {
      cod: 'Cash on delivery',
      manual: 'UPI to your own ID — you confirm it',
      razorpay_upi: 'UPI — confirmed automatically',
      upi: 'UPI',
      bank_transfer: 'Bank transfer',
      cash: 'Cash',
      cheque: 'Cheque',
      other: 'Other',
    } as Record<string, string>,
    reference: 'Reference',
    gatewayId: 'Gateway payment id',
    captured: 'Captured',
    authorised: 'Authorised, not yet captured',
    attempt: (n: number) => `Attempt ${n}`,
    balanceAttempt: 'Balance',
    amount: 'Amount',
    preorder: {
      depositPaid: (amount: string) => `Deposit paid ${amount}`,
      balanceDue: (amount: string) => `Balance due ${amount}`,
      balancePaid: (when: string) => `Balance paid ${when}`,
      requested: (when: string, reminders: number) =>
        `requested ${when}, ${reminders === 1 ? '1 reminder' : `${reminders} reminders`} sent`,
      notRequested: 'not requested yet',
      request: 'Request balance',
      resend: 'Send balance request again',
      requestedToast: 'Balance request sent to the customer',
    },
    transfer: {
      waiting: 'Waiting for the transfer',
      reminderSent: (ago: string) => `Reminder sent ${ago}`,
      noReminder: 'No reminder sent yet',
      nextAt: (when: string) => `Next one possible ${when.charAt(0).toLowerCase()}${when.slice(1)}`,
      send: 'Send payment reminder',
      sentToast: 'Payment reminder sent to the customer',
      hint: (amount: string) => `Check your bank or UPI app for ${amount}, then mark it paid.`,
      markPaid: 'Mark as paid',
    },
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
    markedPaid: (amount: string, method: string) => `Marked as paid: ${amount} by ${method}`,
    markedPaidDetail: (parts: { reference?: string; receivedOn?: string; by?: string }) =>
      [
        parts.reference ? `Reference ${parts.reference}` : null,
        parts.receivedOn ? `received ${parts.receivedOn}` : null,
        parts.by ? `recorded by ${parts.by}` : null,
      ]
        .filter(Boolean)
        .join(', '),
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
    editHint: 'Change the contact and address on this order',
    name: 'Name',
    line1: 'Address line 1',
    line2: 'Address line 2',
    city: 'City',
    state: 'State',
    pincode: 'PIN code',
    copyAll: 'Copy all',
    copyAllCourier: 'Copy all for courier',
    call: 'Call',
    whatsapp: 'WhatsApp',
    copyAllHint:
      'Name, phone, address, city, state and PIN code, one per line, ready for a courier app',
    allDetails: 'Customer details',
    billing: 'Billing address',
    business: 'Business buyer',
    gstin: 'GSTIN',
    note: 'Note from customer',
  },
  editContact: {
    title: 'Edit customer details',
    body: 'Changes apply to this order. The customer profile stays as it is unless you tick the box below.',
    contact: 'Contact',
    shipping: 'Shipping address',
    shippingHint: 'Billing uses the same address.',
    name: 'Name',
    email: 'Email',
    phone: 'Mobile number',
    alsoCustomer: "Also update the customer's saved address",
    alsoCustomerHint: 'Their default address becomes this one, for future orders.',
    save: 'Save',
    cancel: 'Cancel',
    saved: 'Customer details updated',
    unchanged: 'Nothing changed',
    failed: 'Could not save these details',
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
