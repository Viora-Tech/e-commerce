import type { ProductStatus } from '@commerce/core/catalog'
import type {
  OrderFulfillmentStatus,
  OrderLifecycleStatus,
  OrderPaymentStatus,
} from '@commerce/core/order-status'
import {
  CancelCircle,
  CircleCheck,
  DeliveryDelay,
  type IconComponent,
  PackageCheck,
  PackageOpen,
  Truck,
} from '@commerce/ui/icons'
import { appsContent } from '@/data/apps'
import { backInStockContent } from '@/data/back-in-stock'
import { blogListContent } from '@/data/blog'
import { collectionsListContent } from '@/data/collections'
import { customerDetailContent } from '@/data/customers'
import { type DiscountLifecycle, discountsContent } from '@/data/discounts'
import { abandonedContent, draftsContent } from '@/data/drafts'
import { type GiftCardStateFilter, giftCardsContent } from '@/data/gift-cards'
import { gstInvoicesContent } from '@/data/gst-invoices'
import { homeContent } from '@/data/home'
import {
  type PurchaseOrderStatus,
  purchaseOrdersContent,
  type TransferStatus,
  transfersContent,
} from '@/data/inventory'
import { campaignsContent } from '@/data/marketing-campaigns'
import { onlineStoreContent } from '@/data/online-store'
import { orderDetailContent } from '@/data/order-detail'
import { ordersContent } from '@/data/orders'
import { productsListContent } from '@/data/products'
import { type InboundShipmentStatus, inboundShipmentsContent } from '@/data/purchasing'
import { returnsContent } from '@/data/returns'
import { reviewsContent } from '@/data/reviews'
import { shipmentPanelContent } from '@/data/shipping'
import { shopifyImportContent } from '@/data/shopify-import'
import { staffContent } from '@/data/staff'

/*
 * Every status the admin shows, in one place. Tones come from the kit's
 * Colors sheet (8:33): Success #21C45D, Pending #F0D411, Error #EF4343,
 * Cyprus #023337 for in-progress ink, Primary #6467F2 for the accent, Grey #7C7C7C
 * for muted. Every order status gets its own hue so a glance reads the stage.
 * Glyphs come from the status cell on the sheet (14:1041 / frame 5:2624).
 */
export type StatusTone = 'success' | 'pending' | 'error' | 'info' | 'accent' | 'neutral'

export type StatusEntry = {
  label: string
  tone: StatusTone
  /** 24px glyph for the `glyph` variant; falls back to the dot when absent. */
  glyph?: IconComponent | undefined
}

const entry = (label: string, tone: StatusTone, glyph?: IconComponent): StatusEntry => ({
  label,
  tone,
  glyph,
})

export const STATUS = {
  /** An order's lifecycle; drafts and archived-like states read neutral. */
  order: {
    draft: entry(ordersContent.status.draft, 'neutral'),
    open: entry(ordersContent.status.open, 'accent', DeliveryDelay),
    completed: entry(ordersContent.status.completed, 'success', CircleCheck),
    cancelled: entry(ordersContent.status.cancelled, 'neutral', CancelCircle),
  } satisfies Record<OrderLifecycleStatus, StatusEntry>,
  /**
   * The order's derived payment status: list column and detail header pill.
   * Paid is success, refunds info, anything still owed warning, a refund
   * someone has to send red.
   */
  orderPayment: {
    unpaid: entry(ordersContent.paymentStatus.unpaid, 'pending'),
    authorized: entry(ordersContent.paymentStatus.authorized, 'pending'),
    partially_paid: entry(ordersContent.paymentStatus.partially_paid, 'pending'),
    paid: entry(ordersContent.paymentStatus.paid, 'success'),
    partially_refunded: entry(ordersContent.paymentStatus.partially_refunded, 'neutral'),
    refunded: entry(ordersContent.paymentStatus.refunded, 'neutral'),
    refund_needed: entry(ordersContent.paymentStatus.refund_needed, 'error'),
  } satisfies Record<OrderPaymentStatus, StatusEntry>,
  /** One payment attempt (payment card rows, the summary box). */
  payment: {
    created: entry(orderDetailContent.pills.payment.created, 'neutral'),
    pending: entry(orderDetailContent.pills.payment.pending, 'neutral'),
    authorized: entry(orderDetailContent.pills.payment.authorized, 'pending'),
    cancelled: entry(orderDetailContent.pills.payment.cancelled, 'neutral'),
    refund_needed: entry(orderDetailContent.pills.payment.refundNeeded, 'error'),
    captured: entry(orderDetailContent.pills.payment.captured, 'success'),
    refunded: entry(orderDetailContent.pills.payment.refunded, 'info'),
    partially_refunded: entry(orderDetailContent.pills.partiallyRefunded, 'pending'),
    failed: entry(orderDetailContent.pills.payment.failed, 'error'),
  },
  /** The order's derived fulfilment status: list column, header pill, Unfulfilled card. */
  fulfilment: {
    unfulfilled: entry(ordersContent.fulfillmentStatus.unfulfilled, 'pending', PackageOpen),
    partially_fulfilled: entry(
      ordersContent.fulfillmentStatus.partially_fulfilled,
      'pending',
      PackageOpen,
    ),
    fulfilled: entry(ordersContent.fulfillmentStatus.fulfilled, 'success', PackageCheck),
    shipped: entry(ordersContent.fulfillmentStatus.shipped, 'accent', Truck),
    partially_delivered: entry(
      ordersContent.fulfillmentStatus.partially_delivered,
      'accent',
      Truck,
    ),
    delivered: entry(ordersContent.fulfillmentStatus.delivered, 'success', PackageCheck),
    returned: entry(ordersContent.fulfillmentStatus.returned, 'neutral', CancelCircle),
  } satisfies Record<OrderFulfillmentStatus, StatusEntry>,
  refund: {
    pending: entry(orderDetailContent.payment.refundStatus.pending ?? 'Pending', 'pending'),
    processed: entry(orderDetailContent.payment.refundStatus.processed ?? 'Processed', 'success'),
    failed: entry(orderDetailContent.payment.refundStatus.failed ?? 'Failed', 'error'),
    manual: entry(orderDetailContent.payment.refundStatus.manual ?? 'Manual', 'info'),
  },
  /** Gateway webhook events on the payment card. */
  event: {
    processed: entry('Processed', 'success'),
    failed: entry('Failed', 'error'),
    pending: entry('Pending', 'pending'),
  },
  shipment: {
    created: entry(shipmentPanelContent.status.created ?? 'Created', 'pending', DeliveryDelay),
    picked_up: entry(shipmentPanelContent.status.picked_up ?? 'Picked up', 'accent', Truck),
    in_transit: entry(shipmentPanelContent.status.in_transit ?? 'In transit', 'info', Truck),
    out_for_delivery: entry(
      shipmentPanelContent.status.out_for_delivery ?? 'Out for delivery',
      'success',
      Truck,
    ),
    delivered: entry(shipmentPanelContent.status.delivered ?? 'Delivered', 'success', PackageCheck),
    rto: entry(shipmentPanelContent.status.rto ?? 'Returning', 'error', CancelCircle),
    cancelled: entry(shipmentPanelContent.status.cancelled ?? 'Cancelled', 'error', CancelCircle),
  },
  /** A customer return or an RTO task: amber when it waits on the merchant. */
  return: {
    requested: entry(returnsContent.status.requested, 'pending'),
    // Figma Returns: approved blue, on the way back and arrived violet, declined grey.
    approved: entry(returnsContent.status.approved, 'info'),
    rejected: entry(returnsContent.status.rejected, 'neutral'),
    in_transit: entry(returnsContent.status.in_transit, 'accent', Truck),
    received: entry(returnsContent.status.received, 'accent', PackageOpen),
    resolved: entry(returnsContent.status.resolved, 'success', CircleCheck),
    cancelled: entry(returnsContent.status.cancelled, 'neutral'),
  },
  discount: {
    active: entry(discountsContent.lifecycle.active, 'success'),
    scheduled: entry(discountsContent.lifecycle.scheduled, 'info'),
    expired: entry(discountsContent.lifecycle.expired, 'neutral'),
    disabled: entry(discountsContent.lifecycle.disabled, 'neutral'),
  } satisfies Record<DiscountLifecycle, StatusEntry>,
  giftCard: {
    active: entry(giftCardsContent.state.active, 'success'),
    disabled: entry(giftCardsContent.state.disabled, 'neutral'),
    expired: entry(giftCardsContent.state.expired, 'pending'),
    empty: entry(giftCardsContent.state.empty, 'neutral'),
  } satisfies Record<GiftCardStateFilter, StatusEntry>,
  product: {
    active: entry(productsListContent.status.active, 'success'),
    draft: entry(productsListContent.status.draft, 'neutral'),
    archived: entry(productsListContent.status.archived, 'neutral'),
  } satisfies Record<ProductStatus, StatusEntry>,
  purchaseOrder: {
    draft: entry(purchaseOrdersContent.status.draft, 'neutral'),
    ordered: entry(purchaseOrdersContent.status.ordered, 'info'),
    partially_received: entry(purchaseOrdersContent.status.partially_received, 'pending'),
    received: entry(purchaseOrdersContent.status.received, 'success'),
    closed: entry(purchaseOrdersContent.status.closed, 'neutral'),
    cancelled: entry(purchaseOrdersContent.status.cancelled, 'error'),
  } satisfies Record<PurchaseOrderStatus, StatusEntry>,
  inboundShipment: {
    in_transit: entry(inboundShipmentsContent.status.in_transit, 'accent'),
    at_port: entry(inboundShipmentsContent.status.at_port, 'pending'),
    cleared: entry(inboundShipmentsContent.status.cleared, 'info'),
    delivered: entry(inboundShipmentsContent.status.delivered, 'success'),
  } satisfies Record<InboundShipmentStatus, StatusEntry>,
  transfer: {
    draft: entry(transfersContent.status.draft, 'neutral'),
    in_transit: entry(transfersContent.status.in_transit, 'accent'),
    received: entry(transfersContent.status.received, 'success'),
  } satisfies Record<TransferStatus, StatusEntry>,
  stock: {
    inStock: entry(homeContent.bestSelling.inStock, 'success'),
    outOfStock: entry(homeContent.bestSelling.outOfStock, 'error'),
  },
  message: {
    sent: entry(customerDetailContent.timeline.status.sent ?? 'Sent', 'success'),
    queued: entry(customerDetailContent.timeline.status.queued ?? 'Queued', 'pending'),
    failed: entry(customerDetailContent.timeline.status.failed ?? 'Failed', 'error'),
  },
  collectionType: {
    manual: entry(collectionsListContent.list.kind.manual, 'neutral'),
    automatic: entry(collectionsListContent.list.kind.automatic, 'info'),
  },
  /** Whether shoppers can browse a collection. */
  collectionVisibility: {
    active: entry(collectionsListContent.list.visibility.active, 'success'),
    draft: entry(collectionsListContent.list.visibility.draft, 'neutral'),
  },
  page: {
    published: entry(onlineStoreContent.pages.status.published, 'success'),
    draft: entry(onlineStoreContent.pages.status.draft, 'neutral'),
    unsaved: entry(onlineStoreContent.form.unsaved, 'pending'),
  },
  /** Blog posts: a scheduled post that is due reads as published. */
  article: {
    published: entry(blogListContent.status.published, 'success'),
    scheduled: entry(blogListContent.status.scheduled, 'info'),
    draft: entry(blogListContent.status.draft, 'neutral'),
  },
  app: {
    installed: entry(appsContent.installed, 'success'),
    builtIn: entry(appsContent.builtIn, 'neutral'),
    connected: entry(appsContent.connection.connected, 'success'),
    notConnected: entry(appsContent.connection.notConnected, 'neutral'),
  },
  /** GST invoice / document status (queue, list, detail). */
  gstDoc: {
    draft: entry(gstInvoicesContent.statuses.draft, 'neutral'),
    issued: entry(gstInvoicesContent.statuses.issued, 'success'),
    cancelled: entry(gstInvoicesContent.statuses.cancelled, 'error'),
  },
  /** Back in stock: where a signup is in the double opt-in flow. */
  bisSignup: {
    pending_confirmation: entry(backInStockContent.signups.status.pending_confirmation, 'pending'),
    confirmed: entry(backInStockContent.signups.status.confirmed, 'info'),
    notified: entry(backInStockContent.signups.status.notified, 'success'),
    unsubscribed: entry(backInStockContent.signups.status.unsubscribed, 'neutral'),
  },
  /** Product reviews (Reviews app). */
  review: {
    pending: entry(reviewsContent.status.pending, 'pending'),
    published: entry(reviewsContent.status.published, 'success'),
    hidden: entry(reviewsContent.status.hidden, 'neutral'),
  },
  /** Shopify import runs; a finished dry run reads "Preview ready". */
  importRun: {
    queued: entry(shopifyImportContent.status.queued, 'neutral'),
    running: entry(shopifyImportContent.status.running, 'pending'),
    completed: entry(shopifyImportContent.status.completed, 'success'),
    failed: entry(shopifyImportContent.status.failed, 'error'),
    cancelled: entry(shopifyImportContent.status.cancelled, 'neutral'),
    preview: entry(shopifyImportContent.previewReady, 'info'),
  },
  /** One type on "What's left to import". */
  importState: {
    done: entry(shopifyImportContent.remaining.state.done, 'success'),
    missing: entry(shopifyImportContent.remaining.state.missing, 'pending'),
    not_copied: entry(shopifyImportContent.remaining.state.not_copied, 'error'),
    never: entry(shopifyImportContent.remaining.state.never, 'neutral'),
    unknown: entry(shopifyImportContent.remaining.state.unknown, 'neutral'),
  },
  /** Draft orders: open until an invoice goes out. */
  draft: {
    open: entry(draftsContent.status.open, 'info'),
    invoiceSent: entry(draftsContent.status.invoiceSent, 'pending'),
  },
  /** Abandoned baskets: nudged, then recovered when the shopper comes back. */
  abandoned: {
    open: entry(abandonedContent.status.open, 'neutral'),
    sent: entry(abandonedContent.status.sent, 'pending'),
    recovered: entry(abandonedContent.status.recovered, 'success'),
  },
  provider: {
    enabled: entry('Active', 'success'),
    disabled: entry('Off', 'neutral'),
  },
  /** Staff members on the team page. */
  member: {
    active: entry(staffContent.status.active, 'success'),
    invited: entry(staffContent.status.invited, 'pending'),
  },
  /** Badges on the customer detail header. */
  /** Badges on the customer detail header and the list's status column (5:3148). */
  customer: {
    returning: entry(customerDetailContent.badges.returning, 'neutral'),
    vip: entry(customerDetailContent.badges.vip, 'info'),
    active: entry('Active', 'success'),
    inactive: entry('Inactive', 'neutral'),
  },
  /** Marketing campaigns. */
  campaign: {
    draft: entry(campaignsContent.status.draft, 'neutral'),
    scheduled: entry(campaignsContent.status.scheduled, 'info'),
    sending: entry(campaignsContent.status.sending, 'pending'),
    sent: entry(campaignsContent.status.sent, 'success'),
    cancelled: entry(campaignsContent.status.cancelled, 'error'),
    failed: entry(campaignsContent.status.failed, 'error'),
  },
} as const

export type StatusKind = keyof typeof STATUS
export type StatusValue<K extends StatusKind> = keyof (typeof STATUS)[K] & string

/** Look up an entry; unknown values (raw gateway strings) fall back to a neutral label. */
export function statusEntry<K extends StatusKind>(kind: K, value: string): StatusEntry {
  const table = STATUS[kind] as Record<string, StatusEntry>
  return table[value] ?? entry(value, 'neutral')
}
