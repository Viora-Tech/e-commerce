import {
  capturePayment,
  changeOrderStatus,
  heldParcels,
  insertOutboxEvent,
  notTestOrder,
  type OrderStatus,
  type OrderStatusChange,
  orderParcelsWithCharges,
  type PaymentProvider,
  parsePaymentSettings,
  type RefundMethod,
  refundPayment,
  resolvePaymentProviders,
  UNPAID_PAYMENT_STATUSES,
} from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import {
  address,
  customer,
  media,
  notification,
  order,
  orderLine,
  orderNote,
  payment,
  productMedia,
  refund,
  store,
  variant,
} from '@commerce/db'
import type { PaymentRegistry } from '@commerce/payments'
import { and, asc, desc, eq, gte, sql } from 'drizzle-orm'

export {
  ORDER_CHANNEL_FILTERS,
  ORDER_RETURN_FILTERS,
  type OrderChannelFilter,
  type OrderReturnFilter,
  orderCouriers,
  orderFacets,
  orderNumberFromSearch,
} from './order-list-where'
export { ORDER_VIEWS, type OrderView, viewFilter } from './order-views'

export type { OrderStatus }

import { eventsForPayments, withThumbnails } from './order-detail.service'

export {
  listOrders,
  type OrderTabCounts,
  type OrderTiles,
  orderListPage,
  orderTabCounts,
  orderTiles,
  readyToShipCount,
} from './order-list-page.service'

import { notDraft, type OrderListFilters, orderListWhere } from './order-list-where'

/** The most ids "Select all" takes at once; bulk actions above this would need a background job. */
const SELECT_ALL_MAX = 5000

/** Every order id the list's filters match, newest first (the table's "Select all N orders"). */
export async function listOrderIds(tx: StoreTx, input: OrderListFilters): Promise<string[]> {
  const rows = await tx
    .select({ id: order.id })
    .from(order)
    .leftJoin(customer, eq(customer.id, order.customerId))
    .where(orderListWhere(input))
    .orderBy(desc(order.placedAt))
    .limit(SELECT_ALL_MAX)
  return rows.map((r) => r.id)
}

/** Most lines the list's items popover shows; the order page has the rest. */
const LINE_PEEK_MAX = 20

/** An order's lines with a picture each: the Orders list's items popover (#1008). */
export async function listOrderLinePeek(tx: StoreTx, orderId: string) {
  return tx
    .select({
      id: orderLine.id,
      title: orderLine.title,
      variantTitle: orderLine.variantTitle,
      quantity: orderLine.quantity,
      image: sql<string | null>`coalesce(${media.url}, (
        select m.url from ${productMedia} pm join ${media} m on m.id = pm.media_id
        where pm.product_id = ${variant.productId} order by pm.position limit 1))`,
    })
    .from(orderLine)
    .leftJoin(variant, eq(variant.id, orderLine.variantId))
    .leftJoin(media, eq(media.id, variant.mediaId))
    .where(eq(orderLine.orderId, orderId))
    .orderBy(asc(orderLine.id))
    .limit(LINE_PEEK_MAX)
}

export type OrderWindow = { value: number; previous: number }

export type OrderStats = {
  total: OrderWindow
  /** Open orders still waiting for their money. */
  unpaid: OrderWindow
  delivered: OrderWindow
  cancelled: OrderWindow
}

const DAY_MS = 86_400_000
const STATS_WINDOW_DAYS = 7

/** The four tiles above the order list (frame 5:2511): last 7 days against the 7 before. */
export async function orderStats(tx: StoreTx, now = new Date()): Promise<OrderStats> {
  const thisStart = new Date(now.getTime() - STATS_WINDOW_DAYS * DAY_MS)
  const lastStart = new Date(now.getTime() - 2 * STATS_WINDOW_DAYS * DAY_MS)
  const rows = await tx
    .select({
      status: order.status,
      paymentStatus: order.paymentStatus,
      fulfillmentStatus: order.fulfillmentStatus,
      placedAt: order.placedAt,
    })
    .from(order)
    .where(and(notDraft, notTestOrder, gte(order.placedAt, lastStart)))
  const cur = rows.filter((r) => r.placedAt >= thisStart)

  const prev = rows.filter((r) => r.placedAt < thisStart)
  const window = (pick: (r: (typeof rows)[number]) => boolean): OrderWindow => ({
    value: cur.filter(pick).length,
    previous: prev.filter(pick).length,
  })
  return {
    total: window(() => true),
    unpaid: window((r) => r.status === 'open' && UNPAID_PAYMENT_STATUSES.includes(r.paymentStatus)),
    delivered: window((r) => r.status !== 'cancelled' && r.fulfillmentStatus === 'delivered'),
    cancelled: window((r) => r.status === 'cancelled'),
  }
}

export async function getOrder(tx: StoreTx, id: string) {
  const [o] = await tx
    .select()
    .from(order)
    .where(and(eq(order.id, id), notDraft))
  if (!o) return null
  const [lines, payments, refunds, notes, notifications] = await Promise.all([
    tx.select().from(orderLine).where(eq(orderLine.orderId, id)),
    tx.select().from(payment).where(eq(payment.orderId, id)),
    tx.select().from(refund).where(eq(refund.orderId, id)).orderBy(asc(refund.createdAt)),
    tx.select().from(orderNote).where(eq(orderNote.orderId, id)).orderBy(asc(orderNote.createdAt)),
    tx
      .select()
      .from(notification)
      .where(eq(notification.orderId, id))
      .orderBy(asc(notification.createdAt)),
  ])
  const [cust] = o.customerId
    ? await tx.select().from(customer).where(eq(customer.id, o.customerId))
    : []
  const [ship] = o.shippingAddressId
    ? await tx.select().from(address).where(eq(address.id, o.shippingAddressId))
    : []
  const [bill] =
    o.billingAddressId && o.billingAddressId !== o.shippingAddressId
      ? await tx.select().from(address).where(eq(address.id, o.billingAddressId))
      : []
  return {
    ...o,
    status: o.status as OrderStatus,
    lines: await withThumbnails(tx, lines),
    payments,
    refunds,
    notes,
    notifications,
    paymentEvents: await eventsForPayments(tx, payments),
    customer: cust ?? null,
    shippingAddress: ship ?? null,
    /** Where the bill goes when it is not the shipping address; null when they are the same. */
    billingAddress: bill ?? null,
    /** `parcels`: one per warehouse (order/routing.ts); `parcelCourierCharges`: their bookings'. */
    ...(await orderParcelsWithCharges(tx, id, o.shipping)),
    /** Fulfilment on hold (#1011): why, who and when; null while it can ship. */
    hold: await orderHold(tx, id),
  }
}

/** The order's hold as the page shows it, from its first held parcel (holds cover them all). */
async function orderHold(tx: StoreTx, orderId: string) {
  const held = await heldParcels(tx, orderId)
  const first = held[0]
  if (!first) return null
  return {
    code: first.code,
    note: first.reason,
    heldBy: first.heldBy,
    heldAt: first.heldAt,
    parcels: held.length,
  }
}

export async function addOrderNote(
  tx: StoreTx,
  storeId: string,
  input: { orderId: string; body: string; author: string },
) {
  // The order must be this store's: RLS hides other stores' orders from this read, but the
  // foreign key check on insert does not, so a note could otherwise hang off another
  // store's order id (found by the cross-store leak guardrail).
  const [own] = await tx.select({ id: order.id }).from(order).where(eq(order.id, input.orderId))
  if (!own) return null
  const [row] = await tx
    .insert(orderNote)
    .values({ storeId, orderId: input.orderId, body: input.body, author: input.author })
    .returning()
  return row ?? null
}

export async function setOrderTags(tx: StoreTx, id: string, tags: string[]) {
  const [o] = await tx.update(order).set({ tags }).where(eq(order.id, id)).returning()
  return o ?? null
}

/** The store's connected gateway for a payment provider id; null when it is not installed. */
export async function providerForPayment(
  tx: StoreTx,
  storeId: string,
  registry: PaymentRegistry,
  secret: string,
  providerId: string,
): Promise<PaymentProvider | null> {
  const [s] = await tx.select({ payments: store.payments }).from(store).where(eq(store.id, storeId))
  const { providers } = resolvePaymentProviders(registry, parsePaymentSettings(s?.payments), secret)
  return providers.find((p) => p.id === providerId) ?? null
}

export async function refundOrderPayment(
  tx: StoreTx,
  storeId: string,
  registry: PaymentRegistry,
  secret: string,
  input: {
    paymentId: string
    amountPaise: number
    reason?: string | undefined
    manual?: boolean | undefined
    method?: RefundMethod | undefined
    createdBy?: string | null | undefined
    storeCreditExpiresOn?: string | null | undefined
  },
) {
  const [p] = await tx.select().from(payment).where(eq(payment.id, input.paymentId))
  if (!p) return null
  const provider = await providerForPayment(tx, storeId, registry, secret, p.provider)
  const row = await refundPayment({ tx, storeId }, provider, { ...input, secret })
  // Not tagged with a return: this is a direct refund from the order page, so the
  // shopper gets the generic `refund_issued` message (see the outbox relay).
  if (row && row.status !== 'failed') {
    await insertOutboxEvent(tx, storeId, 'refund.created', { orderId: p.orderId, refundId: row.id })
  }
  return row
}

/** "Capture payment" on the order page (#150): take the money a manual-capture checkout authorised. */
export async function captureOrderPayment(
  tx: StoreTx,
  storeId: string,
  registry: PaymentRegistry,
  secret: string,
  paymentId: string,
) {
  const [p] = await tx.select().from(payment).where(eq(payment.id, paymentId))
  if (!p) return null
  const provider = await providerForPayment(tx, storeId, registry, secret, p.provider)
  return capturePayment({ tx, storeId }, provider, paymentId)
}

/**
 * Merchant-driven "mark as". Paid captures the newest open attempt (or records
 * a manual payment), fulfilled and delivered pack what is left, cancelled
 * releases stock; the statuses and events then follow from
 * `recomputeOrderStatuses`, so the order and payment rows never disagree.
 */
export async function setOrderStatus(
  tx: StoreTx,
  storeId: string,
  id: string,
  change: OrderStatusChange,
  opts?: Parameters<typeof changeOrderStatus>[3],
) {
  return (await changeOrderStatus({ tx, storeId }, id, change, opts)) ?? null
}

/**
 * Historical orders brought over by an import are a record, not work to do:
 * no fulfilment, payment, status change or refund may touch them. Returns the
 * source platform when the order (or the payment's order) was imported.
 */
export async function importedSource(
  tx: StoreTx,
  ref: { orderId: string } | { paymentId: string },
): Promise<string | null> {
  const [row] =
    'orderId' in ref
      ? await tx
          .select({ importedFrom: order.importedFrom })
          .from(order)
          .where(eq(order.id, ref.orderId))
      : await tx
          .select({ importedFrom: order.importedFrom })
          .from(payment)
          .innerJoin(order, eq(order.id, payment.orderId))
          .where(eq(payment.id, ref.paymentId))
  return row?.importedFrom ?? null
}
