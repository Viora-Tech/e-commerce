'use server'

import 'server-only'

import { settingsSecret } from '@commerce/config'
import {
  GIFT_CARD_PROVIDER,
  orderViewToken,
  parseMethodDetail,
  paymentState,
  type ShopperPaymentState,
  thankYouPath,
} from '@commerce/core'
import { getRegistries } from '@commerce/core/registries'
import {
  media,
  order,
  orderLine,
  payment,
  productMedia,
  type StoreTx,
  shipment,
  variant,
} from '@commerce/db'
import { formatMoney } from '@commerce/money'
import type { Tracking } from '@commerce/shipping'
import { and, asc, desc, eq, inArray, ne } from 'drizzle-orm'
import { headers } from 'next/headers'
import { storeTimeZone } from './account'
import { type ChatOrderView, chatOrderProgress, chatPaidBy, chatVariantName } from './chat-track'
import { currentCustomer } from './customer-session'
import { clientIp, rateLimited } from './rate-limit'
import { requestStoreId } from './request-store'
import { inStore } from './store-context'
import { contactMatches, orderNumberFrom } from './track-order'

/*
 * The chat widget's "Track my order". The store is always the one the hostname resolved to.
 * A guest proves an order is theirs exactly as on /track-order (number plus the email or mobile,
 * same rate limit, same "not found" whichever half was wrong); a signed-in shopper sees their
 * own last orders, filtered by their customer id on top of RLS.
 */

export type ChatTrackResult =
  | { status: 'found'; order: ChatOrderView }
  | { status: 'not-found' }
  | { status: 'limited' }

/** The same budget as the /track-order form, under the same key, so the two share it. */
const LOOKUP_IP_RULE = { limit: 10, windowMs: 60_000 }

const RECENT_ORDERS = 3

type OrderRow = typeof order.$inferSelect
type PaymentRow = typeof payment.$inferSelect

/** The stored payment status first; the latest attempt only tells unpaid orders apart. */
function paymentOf(o: OrderRow, latest: PaymentRow | undefined): ShopperPaymentState {
  if (o.paymentStatus === 'refunded' || o.paymentStatus === 'partially_refunded') return 'refunded'
  if (o.paymentStatus === 'paid' || o.paymentStatus === 'refund_needed') return 'paid'
  if (o.paymentStatus === 'partially_paid' && o.checkoutPaidAt) return 'paid'
  return paymentState(latest, o.paymentMethod, false)
}

const newest = <T extends { createdAt: Date }>(rows: T[]) =>
  [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]

/** The courier's name from its shipping app ("Delhivery"); null for a hand-typed shipment. */
const courierName = (provider: string) => getRegistries().shipping.get(provider)?.label ?? null

/** The delivered scan's time, when the courier sent one. */
const deliveredScan = (tracking: Tracking | null | undefined) =>
  [...(tracking?.events ?? [])].reverse().find((e) => e.status === 'delivered')?.at ?? null

/** The chat card for each order, in the order given. */
async function orderViews(tx: StoreTx, storeId: string, rows: OrderRow[]) {
  if (rows.length === 0) return []
  const ids = rows.map((r) => r.id)
  const [lines, pays, ships, timeZone] = await Promise.all([
    tx
      .select({
        orderId: orderLine.orderId,
        title: orderLine.title,
        variantTitle: orderLine.variantTitle,
        quantity: orderLine.quantity,
        productId: variant.productId,
        imageUrl: media.url,
      })
      .from(orderLine)
      .innerJoin(variant, eq(variant.id, orderLine.variantId))
      .leftJoin(media, eq(media.id, variant.mediaId))
      .where(inArray(orderLine.orderId, ids))
      .orderBy(asc(orderLine.id)),
    tx.select().from(payment).where(inArray(payment.orderId, ids)),
    tx.select().from(shipment).where(inArray(shipment.orderId, ids)),
    storeTimeZone(tx, storeId),
  ])
  // A line whose variant has no picture falls back to its product's first one.
  const bare = [...new Set(lines.filter((l) => !l.imageUrl).map((l) => l.productId))]
  const productImages = bare.length
    ? await tx
        .select({ productId: productMedia.productId, url: media.url })
        .from(productMedia)
        .innerJoin(media, eq(media.id, productMedia.mediaId))
        .where(and(inArray(productMedia.productId, bare), eq(productMedia.position, 0)))
    : []
  const secret = settingsSecret()

  return rows.map((o): ChatOrderView => {
    const mine = lines.filter((l) => l.orderId === o.id)
    const first = mine[0]
    const latestPay = pays
      .filter((p) => p.orderId === o.id && p.provider !== GIFT_CARD_PROVIDER)
      .sort((a, b) => b.attempt - a.attempt)[0]
    const captured = pays.find(
      (p) => p.orderId === o.id && p.status === 'captured' && p.methodDetail,
    )
    const ship = newest(ships.filter((s) => s.orderId === o.id))
    const tracking = ship?.tracking as Tracking | null | undefined
    const pay = paymentOf(o, latestPay)
    const delivered = o.deliveredAt?.toISOString() ?? deliveredScan(tracking)
    const progress = chatOrderProgress({
      status: o.status as Exclude<OrderRow['status'], 'draft'>,
      paymentStatus: o.paymentStatus,
      fulfillmentStatus: o.fulfillmentStatus,
      shipmentStatus: ship?.status ?? null,
      deliveredAt: o.deliveredAt,
    })
    return {
      number: o.number,
      placedAt: o.placedAt.toISOString(),
      timeZone,
      total: formatMoney(o.totalPaise, 'INR'),
      payment: pay,
      paidBy: chatPaidBy(pay, parseMethodDetail(captured?.methodDetail)?.kind ?? null),
      status: progress.status,
      steps: progress.steps,
      firstItem: first
        ? {
            title: first.title ?? '',
            variant: chatVariantName(first.variantTitle),
            quantity: first.quantity,
            imageUrl:
              first.imageUrl ??
              productImages.find((i) => i.productId === first.productId)?.url ??
              null,
          }
        : null,
      moreItems: Math.max(0, mine.length - 1),
      shipment: ship
        ? {
            courier: courierName(ship.provider),
            waybill: ship.waybill,
            trackingUrl: ship.trackingUrl ?? tracking?.trackingUrl ?? null,
          }
        : null,
      expectedDate: tracking?.expectedDate ?? null,
      deliveredAt: progress.status === 'delivered' ? delivered : null,
      viewUrl: thankYouPath(o.number, orderViewToken(o.id, secret)),
    }
  })
}

/** A guest's order by its number and the email or mobile it was placed with. */
export async function chatTrackOrderAction(input: {
  contact: string
  number: string
}): Promise<ChatTrackResult> {
  const storeId = await requestStoreId()
  const limit = await rateLimited('track-order:ip', clientIp(await headers()), LOOKUP_IP_RULE)
  if (!limit.ok) return { status: 'limited' }

  const number = orderNumberFrom(String(input?.number ?? ''))
  const contact = String(input?.contact ?? '').slice(0, 200)
  if (number === null || !contact.trim()) return { status: 'not-found' }

  const view = await inStore(storeId, async (tx) => {
    const [o] = await tx
      .select()
      .from(order)
      .where(and(eq(order.number, number), ne(order.status, 'draft')))
    if (!o || !contactMatches(contact, o)) return null
    const [one] = await orderViews(tx, storeId, [o])
    return one ?? null
  })
  return view ? { status: 'found', order: view } : { status: 'not-found' }
}

/** The signed-in shopper's last few orders, newest first; null when nobody is signed in. */
export async function chatRecentOrdersAction(): Promise<ChatOrderView[] | null> {
  const storeId = await requestStoreId()
  const me = await currentCustomer(storeId)
  if (!me) return null
  return inStore(storeId, async (tx) => {
    const rows = await tx
      .select()
      .from(order)
      .where(and(eq(order.customerId, me.id), ne(order.status, 'draft')))
      .orderBy(desc(order.placedAt))
      .limit(RECENT_ORDERS)
    return orderViews(tx, storeId, rows)
  })
}
