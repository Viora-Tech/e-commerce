import {
  changeOrderStatus,
  insertOutboxEvent,
  type OrderFulfillmentStatus,
  type OrderPaymentStatus,
  type OrderStatus,
  type OrderStatusChange,
  orderParcelsView,
  type PaymentProvider,
  parsePaymentSettings,
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
  paymentEvent,
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
  ilike,
  inArray,
  isNull,
  lte,
  ne,
  notInArray,
  or,
  type SQL,
  sql,
} from 'drizzle-orm'

export type { OrderStatus }

/** The tabs above the order list. */
export const ORDER_VIEWS = [
  'all',
  'unpaid',
  'unfulfilled',
  'pending_upi',
  'completed',
  'cancelled',
] as const
export type OrderView = (typeof ORDER_VIEWS)[number]

/** Drafts live in the same table but are not orders yet; every list and tile hides them. */
const notDraft = ne(order.status, 'draft')

/**
 * What each tab shows. Unpaid and Unfulfilled are work still to do, so only
 * open orders count; Pending UPI is a manual transfer whose checkout amount
 * has not been matched yet.
 */
function viewFilter(view: OrderView): SQL | undefined {
  switch (view) {
    case 'unpaid':
      return and(
        eq(order.status, 'open'),
        inArray(order.paymentStatus, [...UNPAID_PAYMENT_STATUSES]),
      )
    case 'unfulfilled':
      return and(
        eq(order.status, 'open'),
        inArray(order.fulfillmentStatus, [...UNFULFILLED_STATUSES]),
      )
    case 'pending_upi':
      return and(
        eq(order.status, 'open'),
        isNull(order.checkoutPaidAt),
        eq(order.paymentMethod, 'manual'),
        isNull(order.importedFrom),
      )
    case 'completed':
      return eq(order.status, 'completed')
    case 'cancelled':
      return eq(order.status, 'cancelled')
    default:
      return undefined
  }
}

/** "#1234" or "1234" is an order number; anything else is a name or an email. */
export function orderNumberFromSearch(search: string): number | null {
  const match = /^#?(\d{1,9})$/.exec(search.trim())
  return match ? Number(match[1]) : null
}

export async function listOrders(
  tx: StoreTx,
  input: {
    page: number
    perPage: number
    search?: string | undefined
    view?: OrderView | undefined
    status?: OrderStatus | undefined
    paymentStatus?: OrderPaymentStatus[] | undefined
    fulfillmentStatus?: OrderFulfillmentStatus[] | undefined
  },
) {
  const byNumber = input.search ? orderNumberFromSearch(input.search) : null
  const where = and(
    notDraft,
    input.view ? viewFilter(input.view) : undefined,
    input.search
      ? or(
          ilike(order.email, `%${input.search}%`),
          ilike(customer.name, `%${input.search}%`),
          byNumber === null ? undefined : eq(order.number, byNumber),
        )
      : undefined,
    input.status ? eq(order.status, input.status) : undefined,
    input.paymentStatus?.length ? inArray(order.paymentStatus, input.paymentStatus) : undefined,
    input.fulfillmentStatus?.length
      ? inArray(order.fulfillmentStatus, input.fulfillmentStatus)
      : undefined,
  )
  const base = tx
    .select({
      id: order.id,
      number: order.number,
      /* `notDraft` in the filter guarantees the narrower type callers rely on. */
      status: sql<OrderStatus>`${order.status}`,
      paymentStatus: order.paymentStatus,
      fulfillmentStatus: order.fulfillmentStatus,
      paymentMethod: order.paymentMethod,
      totalPaise: order.totalPaise,
      email: order.email,
      customerName: customer.name,
      placedAt: order.placedAt,
      /* Frame 5:2353 shows the first product with its picture; the rest is a count. */
      firstLineTitle: sql<string | null>`(
        select ol.title from ${orderLine} ol where ol.order_id = ${order.id}
        order by ol.id limit 1)`,
      lineCount: sql<number>`(select count(*)::int from ${orderLine} ol where ol.order_id = ${order.id})`,
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
  const items = await base
    .orderBy(desc(order.placedAt))
    .limit(input.perPage)
    .offset((input.page - 1) * input.perPage)
  return { items, total: countRow?.total ?? 0 }
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

/** Open orders nobody has shipped yet that are paid, or cash on delivery: "Ready to ship". */
const readyToShipWhere = () =>
  and(
    eq(order.status, 'open'),
    inArray(order.fulfillmentStatus, [...UNFULFILLED_STATUSES]),
    or(
      notInArray(order.paymentStatus, [...UNPAID_PAYMENT_STATUSES]),
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
  const live = and(notDraft, ne(order.status, 'cancelled'))
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
    .where(and(notDraft, gte(order.placedAt, lastStart)))
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
    /** Where each part ships from: one parcel per warehouse (order/routing.ts). */
    parcels: await orderParcelsView(tx, id),
  }
}

type Line = typeof orderLine.$inferSelect

/** Variant image, else the product's first image, else nothing. */
async function withThumbnails(tx: StoreTx, lines: Line[]) {
  if (lines.length === 0) return []
  const ids = lines.map((l) => l.variantId)
  const rows = await tx
    .select({
      variantId: variant.id,
      productId: variant.productId,
      sku: variant.sku,
      variantImage: media.url,
      productImage: sql<string | null>`(
        select m.url from ${productMedia} pm join ${media} m on m.id = pm.media_id
        where pm.product_id = ${variant.productId} order by pm.position limit 1)`,
    })
    .from(variant)
    .leftJoin(media, eq(media.id, variant.mediaId))
    .where(inArray(variant.id, ids))
  const byId = new Map(rows.map((r) => [r.variantId, r]))
  return lines.map((l) => {
    const v = byId.get(l.variantId)
    return {
      ...l,
      productId: v?.productId ?? null,
      sku: v?.sku ?? null,
      imageUrl: v?.variantImage ?? v?.productImage ?? null,
    }
  })
}

type Payment = typeof payment.$inferSelect

/**
 * payment_event has no order column (webhooks arrive before we know the
 * order); match on the gateway's own ids inside the stored payload instead.
 */
async function eventsForPayments(tx: StoreTx, payments: Payment[]) {
  const refs = payments.flatMap((p) => [p.providerRef, p.providerPaymentId]).filter(Boolean)
  if (refs.length === 0) return []
  return tx
    .select({
      id: paymentEvent.id,
      provider: paymentEvent.provider,
      type: paymentEvent.type,
      status: paymentEvent.status,
      error: paymentEvent.error,
      receivedAt: paymentEvent.receivedAt,
    })
    .from(paymentEvent)
    .where(or(...refs.map((r) => sql`${paymentEvent.payload}::text like ${`%${r}%`}`)))
    .orderBy(asc(paymentEvent.receivedAt))
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
  input: { paymentId: string; amountPaise: number; reason?: string | undefined },
) {
  const [p] = await tx.select().from(payment).where(eq(payment.id, input.paymentId))
  if (!p) return null
  const provider = await providerForPayment(tx, storeId, registry, secret, p.provider)
  const row = await refundPayment({ tx, storeId }, provider, input)
  // Not tagged with a return: this is a direct refund from the order page, so the
  // shopper gets the generic `refund_issued` message (see the outbox relay).
  if (row && row.status !== 'failed') {
    await insertOutboxEvent(tx, storeId, 'refund.created', { orderId: p.orderId, refundId: row.id })
  }
  return row
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
