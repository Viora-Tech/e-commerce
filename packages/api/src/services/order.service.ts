import {
  changeOrderStatus,
  type PaymentProvider,
  parsePaymentSettings,
  refundPayment,
  resolvePaymentProviders,
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
  paymentEvent,
  productMedia,
  refund,
  store,
  variant,
} from '@commerce/db'
import type { PaymentRegistry } from '@commerce/payments'
import { and, asc, count, desc, eq, gte, ilike, inArray, ne, or, sql } from 'drizzle-orm'

export type OrderStatus = 'placed' | 'paid' | 'fulfilled' | 'delivered' | 'cancelled'

/** Drafts live in the same table but are not orders yet; every list and tile hides them. */
const notDraft = ne(order.status, 'draft')

export async function listOrders(
  tx: StoreTx,
  input: {
    page: number
    perPage: number
    search?: string | undefined
    status?: OrderStatus | undefined
  },
) {
  const where = and(
    notDraft,
    input.search
      ? or(ilike(order.email, `%${input.search}%`), ilike(customer.name, `%${input.search}%`))
      : undefined,
    input.status ? eq(order.status, input.status) : undefined,
  )
  const base = tx
    .select({
      id: order.id,
      number: order.number,
      /* `notDraft` in the filter guarantees the narrower type callers rely on. */
      status: sql<OrderStatus>`${order.status}`,
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

export type OrderWindow = { value: number; previous: number }

export type OrderStats = {
  total: OrderWindow
  placed: OrderWindow
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
    .select({ status: order.status, placedAt: order.placedAt })
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
    placed: window((r) => r.status === 'placed'),
    delivered: window((r) => r.status === 'delivered'),
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
    return { ...l, sku: v?.sku ?? null, imageUrl: v?.variantImage ?? v?.productImage ?? null }
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
async function providerForPayment(
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
  return refundPayment({ tx, storeId }, provider, input)
}

/**
 * Merchant-driven status change. "Paid" means the money arrived (cash on
 * delivery, a bank transfer they matched by hand), so pending payments are
 * captured too; otherwise the order and payment rows would disagree.
 */
export async function setOrderStatus(
  tx: StoreTx,
  storeId: string,
  id: string,
  status: OrderStatus,
) {
  const o = await changeOrderStatus({ tx, storeId }, id, status)
  if (o && status === 'paid') {
    await tx
      .update(payment)
      .set({ status: 'captured' })
      .where(and(eq(payment.orderId, id), eq(payment.status, 'pending')))
  }
  return o ?? null
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
