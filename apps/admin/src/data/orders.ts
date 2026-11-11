import type {
  OrderFulfillmentStatus,
  OrderLifecycleStatus,
  OrderMark,
  OrderPaymentStatus,
  OrderStatus,
} from '@commerce/core/order-status'
import { CHANNEL_LABELS } from '@/data/growth'
import type {
  ChannelFilter,
  DateFilter,
  FulfilmentFilter,
  MethodFilter,
  PaymentFilter,
  ReturnFilter,
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
  'balance_due',
  'completed',
  'cancelled',
  'payment_not_finished',
  'archived',
] as const
export type OrderListFilter = (typeof ORDER_LIST_FILTERS)[number]

/** Copy for the orders list and shared order labels. */
export const ordersContent = {
  row: {
    openNewTab: 'Open in a new tab',
    open: 'Open order',
    sameCustomer: 'Orders from this customer',
    createShipment: 'Create shipment',
    cancelShipment: 'Cancel shipment',
    cancelShipmentTitle: 'Cancel this shipment?',
    cancelShipmentBody:
      'The courier booking is cancelled and the order goes back to waiting to ship. A shipment already picked up cannot be cancelled here.',
    cancelShipmentConfirm: 'Cancel shipment',
    keepShipment: 'Keep shipment',
    noShipment: 'This order has no booked shipment to cancel.',
    addTags: 'Add tags',
    removeTags: 'Remove tags',
    addTagsTitle: 'Add tags',
    removeTagsTitle: 'Remove tags',
    tagsBody: 'Type a tag and press Enter.',
    tagsSave: 'Save tags',
    tagsCancel: 'Cancel',
    tagsSaved: 'Tags saved',
    apps: 'Apps',
    copyNumber: 'Copy order number',
    numberCopied: 'Order number copied',
    unarchive: 'Unarchive order',
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
    ready: { label: 'Ready to ship', note: 'Paid or authorised, waiting on a courier' },
    pendingUpi: { label: 'Pending UPI', note: 'Awaiting the transfer' },
    sales: { label: 'Sales this week', trendNote: 'vs last week' },
  },
  noResults: { heading: 'No orders match', body: 'Try another search, or clear the filters.' },
  loadFailed: 'Could not load orders',
  addOrder: 'Add order',
  moreActions: 'More actions',
  menu: {
    /** #12: a CSV of every order the current tab, search and filters match. */
    exportView: 'Export orders (CSV)',
    drafts: 'Draft orders',
    abandoned: 'Abandoned checkouts',
    returns: 'Returns',
  },
  export: 'Export',
  resource: { singular: 'order', plural: 'orders' },
  /** The table's View select (Figma "Table / View select"). */
  viewLabel: 'Order view',
  /** Status column for a paid order nobody has shipped yet (Figma: blue "To ship"). */
  toShip: 'To ship',
  /**
   * The Delivery status column's words for where a packed order is, as Shopify's Delivery status
   * shows them: packed with a label but not collected yet, then with the courier.
   */
  deliveryStage: { fulfilled: 'To be picked up', shipped: 'In transit' },
  /** Chip on an order paid with the payment gateway in test mode (no real money). */
  testChip: 'Test',
  /** Fulfilment held (#1011), in the Status column. */
  holdChip: 'On hold',
  testChipHint:
    'Paid in test mode: no real money moved. Left out of analytics, reports and GST invoices.',
  /** "Delete test orders" in More actions, shown only while test orders exist. */
  deleteTests: {
    menu: 'Delete test orders',
    title: (n: number) => `Delete ${n} test ${n === 1 ? 'order' : 'orders'}?`,
    body: 'Orders paid with a payment gateway in test mode are removed with their payments, notes and parcels. Real orders are never touched. This cannot be undone.',
    confirm: 'Delete test orders',
    done: (n: number) => `${n} test ${n === 1 ? 'order' : 'orders'} deleted`,
    failed: 'Could not delete test orders',
  },

  /** The sort menu's direction labels for the Date column (Figma "State · Sort open"). */
  sortNewest: 'Newest first',
  sortOldest: 'Oldest first',
  /** The View select while filters are applied (Figma "Custom"). */
  customView: 'Custom',
  /** The filter panel and its chips (Figma "Orders · Filter", "Applied filters"). */
  filters: {
    /** The Product picker (Shopify's "Product is …"): products and variants to tick. */
    product: 'Product',
    /** The older free-text filter: no longer in the menu, but an old link's `?product=` shows as this chip. */
    productText: 'Product title or SKU',
    productPlaceholder: 'Product name or SKU',
    picker: {
      search: 'Search products or SKU',
      /** The Is / Is not switch. */
      is: 'Is',
      isNot: 'Is not',
      matchLabel: 'Orders that',
      /** The chip's value: the first pick, then how many more. */
      more: (first: string, n: number) => `${first}, +${n}`,
      /** The chip while the picked names load. */
      count: (n: number) => `${n} picked`,
      variantCount: (n: number) => `${n} ${n === 1 ? 'variant' : 'variants'}`,
      openVariants: (title: string) => `Variants of ${title}`,
      back: 'All products',
      allVariants: 'All variants',
      empty: 'No products found',
      failed: 'Could not load products',
      retry: 'Try again',
      loadMore: 'Show more',
      tooMany: (n: number) => `Up to ${n} products and ${n} variants`,
    },
    payment: 'Payment',
    fulfilment: 'Fulfilment',
    date: 'Date',
    anyDate: 'Any date',
    method: 'Payment method',
    courier: 'Courier',
    anyCourier: 'Any courier',
    collection: 'Collection',
    total: 'Order value',
    totalMin: 'Min value',
    totalMax: 'Max value',
    channel: 'Channel',
    tags: 'Tags',
    discount: 'Discount code',
    returns: 'Return status',
    show: (n: number) => `Show ${n} ${n === 1 ? 'order' : 'orders'}`,
    paymentOptions: {
      paid: 'Paid',
      unpaid: 'Unpaid',
      payment_pending: 'Payment pending',
      partially_refunded: 'Partly refunded',
      refunded: 'Refunded',
      refund_needed: 'Refund needed',
    } satisfies Record<PaymentFilter, string>,
    fulfilmentOptions: {
      unfulfilled: 'Unfulfilled',
      shipped: 'Shipped',
      delivered: 'Delivered',
      returned: 'Returned',
      on_hold: 'On hold',
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
    /** The Channel column's names, so a filter and the column read the same. */
    channelOptions: CHANNEL_LABELS satisfies Record<ChannelFilter, string>,
    returnOptions: {
      none: 'No return',
      requested: 'Return asked for',
      in_progress: 'Return on the way',
      done: 'Returned',
      declined: 'Return declined',
    } satisfies Record<ReturnFilter, string>,
  },
  tabs: {
    all: 'All orders',
    unpaid: 'Unpaid',
    unfulfilled: 'Unfulfilled',
    pending_upi: 'Pending UPI',
    balance_due: 'Balance due',
    completed: 'Completed',
    cancelled: 'Cancelled',
    payment_not_finished: 'Payment pending',
    archived: 'Archived',
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
    partially_refunded: 'Partly refunded',
    refunded: 'Refunded',
    refund_needed: 'Refund needed',
  } satisfies Record<OrderPaymentStatus, string>,
  /** A cancelled order nobody paid (#123): nothing is pending any more, as Shopify's "Voided". */
  paymentVoided: 'Voided',
  /** A cancelled order still holding the customer's money: it has to go back. */
  paymentRefundDue: 'Refund due',
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
    status: 'Delivery status',
    channel: 'Channel',
    tags: 'Tags',
    items: 'Items',
    delivery: 'Delivery',
    phone: 'Phone',
    city: 'City',
  },
  /** The Delivery column before any shipment is booked. */
  noDelivery: 'Not shipped',
  /** Fulfilled without a courier booking. */
  noTracking: 'No tracking',
  /** The sort menu's names where they differ from the header (Figma "State · Sort open"). */
  sortTitles: {
    order: 'Order number',
    customer: 'Customer name',
    payment: 'Payment status',
    fulfilment: 'Fulfilment status',
  },
  moreLines: (n: number) => `+${n} more`,
  /** The arrow by "+n more": a popover with the order's items (#1008). */
  linePeek: {
    open: (n: number) => `Show the ${n} items`,
    title: (n: number) => (n === 1 ? '1 item' : `${n} items`),
    loading: 'Loading items…',
    failed: 'Could not load the items',
    untitled: 'Untitled item',
    quantity: (n: number) => `× ${n}`,
    more: 'Open the order to see every item',
  },
  /** On an archived order's row (search and the Archived tab). */
  archivedChip: 'Archived',
  /** The Delivery chip when its shipment has a tracking page. */
  trackDelivery: 'Open tracking in a new tab',
  bulk: {
    markAs: 'Mark as',
    bulkEdit: 'Bulk edit',
    updated: (n: number, status: string) => `${n} marked ${status.toLowerCase()}`,
    /** Some were cancelled, imported or otherwise could not take the change. */
    updatedSkipped: (n: number, status: string, skipped: number) =>
      `${n} marked ${status.toLowerCase()}, ${skipped} skipped (cancelled or imported)`,
    partlyFailed: (n: number, failed: number) =>
      `${n} updated, ${failed} could not be updated. Try those again.`,
    noneUpdated: (skipped: number) =>
      skipped === 1
        ? '1 order skipped: cancelled or imported orders cannot change'
        : `${skipped} orders skipped: cancelled or imported orders cannot change`,
    failed: 'Could not update orders',
  },
  empty: {
    heading: 'No orders yet',
    body: 'Orders appear here as soon as a customer checks out.',
  },
  /** A status tab with no orders, before any search or filter. */
  emptyView: {
    heading: 'No orders here',
    body: 'Orders show up in this view as soon as one matches it.',
  },
  emptyArchived: {
    heading: 'No archived orders yet',
    body: 'Orders you archive move here, out of the main list.',
  },
} as const

/** Sub-sections under Orders that have no records yet. */
const IMPORTED_STATUS: Record<string, string> = {
  paid: 'Paid',
  pending: 'Payment pending',
  authorized: 'Authorized',
  partially_paid: 'Partially paid',
  partially_refunded: 'Partly refunded',
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

/** The "Review email" dialog before a hand-sent order message goes out. */
export const sendMessageContent = {
  help: 'This is exactly what your customer will get, filled with this order. Nothing goes out until you press send.',
  loading: 'Loading the email',
  failed: 'Could not load the email preview. Try again in a moment.',
  off: 'This message is switched off in Settings → Notifications, so sending will not deliver anything.',
  to: 'To',
  subject: 'Subject',
  message: 'Custom message (optional)',
  messagePlaceholder: 'Add a note for your customer. It shows above the order details.',
  previewHeading: 'Preview',
  noContact: 'No email or phone on this order',
  email: 'Email',
  whatsapp: 'WhatsApp',
  both: 'Both',
  sendBy: 'Send by',
  chatHint:
    'WhatsApp is not connected to your store, so it cannot send this for you. Open it in your own WhatsApp and press send there.',
  chatHintConnected: 'Or open it in your own WhatsApp to type it yourself and press send there.',
  openChat: 'Open in WhatsApp',
  frameTitle: 'Email preview',
  cancel: 'Cancel',
  templates: {
    draft_invoice: { title: 'Send invoice', send: 'Send invoice' },
    balance_request: { title: 'Request balance', send: 'Send request' },
    payment_reminder: { title: 'Send payment reminder', send: 'Send reminder' },
    order_link: { title: 'Send order link', send: 'Send link' },
    checkout_recovery: { title: 'Send checkout reminder', send: 'Send reminder' },
  },
}
