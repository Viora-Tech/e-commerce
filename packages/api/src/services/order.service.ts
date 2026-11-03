import {
  capturePayment,
  changeOrderStatus,
  heldParcels,
  insertOutboxEvent,
  notTestOrder,
  type OrderStatus,
  type OrderStatusChange,
  orderParcelsView,
  type PaymentProvider,
  parsePaymentSettings,
  type RefundMethod,
  refundPayment,
  resolvePaymentProviders,
  UNFULFILLED_STATUSES,
  UNPAID_PAYMENT_STATUSES,
} from '@commerce/core'
import { startOfDay } from '@commerce/dates'
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
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lte,
  ne,
  notInArray,
  or,
  sql,
} from 'drizzle-orm'

export { ORDER_VIEWS, type OrderView, viewFilter } from './order-views'

import { viewFilter } from './order-views'

export {
  ORDER_CHANNEL_FILTERS,
  ORDER_RETURN_FILTERS,
  type OrderChannelFilter,
  type OrderReturnFilter,
  orderCouriers,
  orderFacets,
  orderNumberFromSearch,
} from './order-list-where'
export type { OrderStatus }

import { eventsForPayments, withThumbnails } from './order-detail.service'
import { notDraft, type OrderListFilters, onHoldSql, orderListWhere } from './order-list-where'

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

export async function listOrders(
  tx: StoreTx,
  input: OrderListFilters & { page: number; perPage: number },
) {
  const where = orderListWhere(input)
  const base = tx
    .select({
      id: order.id,
      number: order.number,
      /* `notDraft` in the filter guarantees the narrower type callers rely on. */
      status: sql<OrderStatus>`${order.status}`,
      paymentStatus: order.paymentStatus,
      fulfillmentStatus: order.fulfillmentStatus,
      paymentMethod: order.paymentMethod,
      /** Set while it is a read-only import; the row menu then offers only safe items (#47). */
      importedFrom: order.importedFrom,
      totalPaise: order.totalPaise,
      email: order.email,
      customerName: customer.name,
      /* Paid on a gateway's test keys: the list shows a "Test" chip. */
      isTest: order.isTest,
      placedAt: order.placedAt,
      /* The Channel and Tags columns (Figma "State · Columns open"): where the visit came from. */
      channel: sql<string | null>`${order.attribution}->>'channel'`,
      tags: order.tags,
      archivedAt: order.archivedAt,
      /* Fulfilment held (#1011): the row shows an "On hold" chip. */
      onHold: onHoldSql,
      /* Frame 5:2353 shows the first product with its picture; the rest is a count. */
      firstLineTitle: sql<string | null>`(
        select ol.title from ${orderLine} ol where ol.order_id = ${order.id}
        order by ol.id limit 1)`,
      lineCount: sql<number>`(select count(*)::int from ${orderLine} ol where ol.order_id = ${order.id})`,
      /* The optional Items, Delivery, Phone and City columns (audit #7, #49). */
      itemCount: sql<number>`(select coalesce(sum(ol.quantity), 0)::int from ${orderLine} ol where ol.order_id = ${order.id})`,
      deliveryStatus: sql<string | null>`(
        select s.status from shipment s where s.order_id = ${order.id}
        order by s.created_at desc limit 1)`,
      /* The same shipment's tracking page: the Delivery chip links to it (#1008). */
      trackingUrl: sql<string | null>`(
        select s.tracking_url from shipment s where s.order_id = ${order.id}
        order by s.created_at desc limit 1)`,
      shipCity: sql<
        string | null
      >`(select a.city from ${address} a where a.id = ${order.shippingAddressId})`,
      shipPhone: sql<
        string | null
      >`(select a.phone from ${address} a where a.id = ${order.shippingAddressId})`,
      firstLineImage: sql<string | null>`(
        select coalesce(vm.url, (
          select m.url from ${productMedia} pm join ${media} m on m.id = pm.media_id
          where pm.product_id = v.product_id order by pm.position limit 1))
        from ${orderLine} ol
        join ${variant} v on v.id = ol.variant_id
        left join ${media} vm on vm.id = v.media_id
        where ol.order_id = ${order.id} order by ol.id limit 1)`,
    })
    .from(order)
    .leftJoin(customer, eq(customer.id, order.customerId))
    .where(where)
  const [countRow] = await tx
    .select({ total: count() })
    .from(order)
    .leftJoin(customer, eq(customer.id, order.customerId))
    .where(where)
  const [items, [testRow]] = await Promise.all([
    base
      .orderBy(desc(order.placedAt))
      .limit(input.perPage)
      .offset((input.page - 1) * input.perPage),
    /* Store-wide, whatever the filters: "Delete test orders" shows only when there are some. */
    tx.select({ n: count() }).from(order).where(eq(order.isTest, true)),
  ])
  return { items, total: countRow?.total ?? 0, testOrders: testRow?.n ?? 0 }
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

export type OrderTiles = {
  /** Orders placed since midnight (IST) and the count by the same time yesterday. */
  newToday: { value: number; previous: number }
  /** Open orders that are paid (or cash on delivery) and still to pack. */
  readyToShip: number
  /** Manual UPI / bank transfers waiting to be matched. */
  pendingUpi: number
  /** Money from orders placed in the last 7 days (not cancelled) and the 7 days before. */
  salesWeek: { paise: number; previousPaise: number }
}

/**
 * Open orders nobody has shipped yet that are paid, authorised (the card is approved and the
 * money is captured on shipping, as Shopify counts them), or cash on delivery: "Ready to ship".
 */
const readyToShipWhere = () =>
  and(
    eq(order.status, 'open'),
    isNull(order.archivedAt),
    inArray(order.fulfillmentStatus, [...UNFULFILLED_STATUSES]),
    or(
      notInArray(order.paymentStatus, [...UNPAID_PAYMENT_STATUSES]),
      eq(order.paymentStatus, 'authorized'),
      eq(order.paymentMethod, 'cod'),
    ),
  )

/** How many orders wait to ship: the count pill on the sidebar's Orders row (Figma). */
export async function readyToShipCount(tx: StoreTx): Promise<number> {
  const [row] = await tx.select({ n: count() }).from(order).where(readyToShipWhere())
  return row?.n ?? 0
}

/** The four stat cards above the Orders list (Figma "Orders / List"). */
export async function orderTiles(tx: StoreTx, now = new Date()): Promise<OrderTiles> {
  const todayStart = startOfDay(now)
  const yesterdayStart = startOfDay(now, undefined, -1)
  const sameTimeYesterday = new Date(now.getTime() - 86_400_000)
  const weekStart = new Date(now.getTime() - 7 * 86_400_000)
  const lastWeekStart = new Date(now.getTime() - 14 * 86_400_000)
  // Test-mode orders (gateway test keys) moved no real money: not counted as new or as sales.
  const live = and(notDraft, ne(order.status, 'cancelled'), notTestOrder)
  const [[today], [yesterday], [ready], [upi], weekRows] = await Promise.all([
    tx
      .select({ n: count() })
      .from(order)
      .where(and(live, gte(order.placedAt, todayStart))),
    tx
      .select({ n: count() })
      .from(order)
      .where(
        and(live, gte(order.placedAt, yesterdayStart), lte(order.placedAt, sameTimeYesterday)),
      ),
    tx.select({ n: count() }).from(order).where(readyToShipWhere()),
    tx.select({ n: count() }).from(order).where(viewFilter('pending_upi')),
    tx
      .select({ totalPaise: order.totalPaise, placedAt: order.placedAt })
      .from(order)
      .where(and(live, gte(order.placedAt, lastWeekStart))),
  ])
  const sum = (rows: typeof weekRows) => rows.reduce((t, r) => t + r.totalPaise, 0)
  return {
    newToday: { value: today?.n ?? 0, previous: yesterday?.n ?? 0 },
    readyToShip: ready?.n ?? 0,
    pendingUpi: upi?.n ?? 0,
    salesWeek: {
      paise: sum(weekRows.filter((r) => r.placedAt >= weekStart)),
      previousPaise: sum(weekRows.filter((r) => r.placedAt < weekStart)),
    },
  }
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
    /** Where each part ships from: one parcel per warehouse (order/routing.ts). */
    parcels: await orderParcelsView(tx, id),
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

/** Build the gateway for a payment from the store's saved credentials; null for offline methods. */
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
) {
  return (await changeOrderStatus({ tx, storeId }, id, change)) ?? null
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
