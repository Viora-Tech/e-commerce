/** The order page's extras: line thumbnails and the gateway events of its payments. Split out of order.service.ts. */
import { CUSTOM_ITEM_HANDLE, type OrderStatus } from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import {
  media,
  type orderLine,
  type payment,
  paymentEvent,
  product,
  productMedia,
  variant,
} from '@commerce/db'
import { asc, eq, inArray, or, sql } from 'drizzle-orm'

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

type Line = typeof orderLine.$inferSelect

/** Variant image, else the product's first image, else nothing. */
export async function withThumbnails(tx: StoreTx, lines: Line[]) {
  if (lines.length === 0) return []
  const ids = lines.map((l) => l.variantId)
  const rows = await tx
    .select({
      variantId: variant.id,
      productId: variant.productId,
      handle: product.handle,
      sku: variant.sku,
      variantImage: media.url,
      productImage: sql<string | null>`(
        select m.url from ${productMedia} pm join ${media} m on m.id = pm.media_id
        where pm.product_id = ${variant.productId} order by pm.position limit 1)`,
    })
    .from(variant)
    .innerJoin(product, eq(product.id, variant.productId))
    .leftJoin(media, eq(media.id, variant.mediaId))
    .where(inArray(variant.id, ids))
  const byId = new Map(rows.map((r) => [r.variantId, r]))
  return lines.map((l) => {
    const v = byId.get(l.variantId)
    return {
      ...l,
      // A draft's custom item sits on a hidden product: no "View product" link to it.
      productId: v && v.handle !== CUSTOM_ITEM_HANDLE ? v.productId : null,
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
export async function eventsForPayments(tx: StoreTx, payments: Payment[]) {
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
