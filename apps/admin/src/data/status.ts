import type { ProductStatus } from '@commerce/core/catalog'
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
import { blogListContent } from '@/data/blog'
import { customerDetailContent } from '@/data/customers'
import { type DiscountLifecycle, discountsContent } from '@/data/discounts'
import { abandonedContent, draftsContent } from '@/data/drafts'
import { homeContent } from '@/data/home'
import {
  type PurchaseOrderStatus,
  purchaseOrdersContent,
  type TransferStatus,
  transfersContent,
} from '@/data/inventory'
import { onlineStoreContent } from '@/data/online-store'
import { type OrderStatus, orderDetailContent, ordersContent } from '@/data/orders'
import { productsListContent } from '@/data/products'
import { shipmentPanelContent } from '@/data/shipping'
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
  order: {
    placed: entry(ordersContent.status.placed, 'pending', DeliveryDelay),
    paid: entry(ordersContent.status.paid, 'accent', CircleCheck),
    fulfilled: entry(ordersContent.status.fulfilled, 'info', Truck),
    delivered: entry(ordersContent.status.delivered, 'success', PackageCheck),
    cancelled: entry(ordersContent.status.cancelled, 'error', CancelCircle),
  } satisfies Record<OrderStatus, StatusEntry>,
  /** Payment column of the order list and the detail header. */
  payment: {
    paid: entry(ordersContent.payment.paid, 'success'),
    unpaid: entry(ordersContent.payment.codPending, 'error'),
    cod: entry(ordersContent.payment.cod, 'neutral'),
    pending: entry(orderDetailContent.pills.payment.pending, 'neutral'),
    captured: entry(orderDetailContent.pills.payment.captured, 'success'),
    refunded: entry(orderDetailContent.pills.payment.refunded, 'neutral'),
    partially_refunded: entry(orderDetailContent.pills.partiallyRefunded, 'pending'),
    failed: entry(orderDetailContent.pills.payment.failed, 'error'),
  },
  fulfilment: {
    unfulfilled: entry(orderDetailContent.pills.fulfilment.unfulfilled, 'neutral', PackageOpen),
    fulfilled: entry(orderDetailContent.pills.fulfilment.fulfilled, 'info', Truck),
    delivered: entry(orderDetailContent.pills.fulfilment.delivered, 'success', PackageCheck),
  },
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
  discount: {
    active: entry(discountsContent.lifecycle.active, 'success'),
    scheduled: entry(discountsContent.lifecycle.scheduled, 'accent'),
    expired: entry(discountsContent.lifecycle.expired, 'neutral'),
    disabled: entry(discountsContent.lifecycle.disabled, 'error'),
  } satisfies Record<DiscountLifecycle, StatusEntry>,
  product: {
    active: entry(productsListContent.status.active, 'success'),
    draft: entry(productsListContent.status.draft, 'info'),
    archived: entry(productsListContent.status.archived, 'neutral'),
  } satisfies Record<ProductStatus, StatusEntry>,
  purchaseOrder: {
    draft: entry(purchaseOrdersContent.status.draft, 'info'),
    ordered: entry(purchaseOrdersContent.status.ordered, 'accent'),
    partially_received: entry(purchaseOrdersContent.status.partially_received, 'pending'),
    received: entry(purchaseOrdersContent.status.received, 'success'),
    closed: entry(purchaseOrdersContent.status.closed, 'neutral'),
  } satisfies Record<PurchaseOrderStatus, StatusEntry>,
  transfer: {
    draft: entry(transfersContent.status.draft, 'info'),
    in_transit: entry(transfersContent.status.in_transit, 'pending'),
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
  page: {
    published: entry(onlineStoreContent.pages.status.published, 'success'),
    draft: entry(onlineStoreContent.pages.status.draft, 'info'),
    unsaved: entry(onlineStoreContent.form.unsaved, 'pending'),
  },
  /** Blog posts: a scheduled post that is due reads as published. */
  article: {
    published: entry(blogListContent.status.published, 'success'),
    scheduled: entry(blogListContent.status.scheduled, 'accent'),
    draft: entry(blogListContent.status.draft, 'info'),
  },
  app: {
    installed: entry(appsContent.installed, 'success'),
    builtIn: entry(appsContent.builtIn, 'neutral'),
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
    returning: entry(customerDetailContent.badges.returning, 'info'),
    vip: entry(customerDetailContent.badges.vip, 'pending'),
    active: entry('Active', 'success'),
    inactive: entry('Inactive', 'error'),
  },
} as const

export type StatusKind = keyof typeof STATUS
export type StatusValue<K extends StatusKind> = keyof (typeof STATUS)[K] & string

/** Look up an entry; unknown values (raw gateway strings) fall back to a neutral label. */
export function statusEntry<K extends StatusKind>(kind: K, value: string): StatusEntry {
  const table = STATUS[kind] as Record<string, StatusEntry>
  return table[value] ?? entry(value, 'neutral')
}
