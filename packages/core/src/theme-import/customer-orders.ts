/** SOURCE OF TRUTH: the signed-in shopper's orders for imported themes — WHAT: `customer.orders` data (the latest orders, newest first, with their lines, images and courier consignments), loaded only when a theme reads it / WHY: Shopify themes list and track a shopper's orders from `customer.orders`; filtered by the shopper's id on top of RLS, so one shopper never reads another's orders */
import {
  fulfillmentOrderLine,
  media,
  order,
  orderLine,
  product,
  productMedia,
  type StoreTx,
  shipment,
  variant,
} from '@commerce/db'
import { type MarketPricing, presentmentCents } from '@commerce/money'
import type { Tracking } from '@commerce/shipping'
import { and, desc, eq, inArray, ne } from 'drizzle-orm'
import type { LiquidFulfillmentData, LiquidOrderData } from './drops'

/** As many as Shopify hands `customer.orders` without paginating. */
export const CUSTOMER_ORDERS_LIMIT = 20

/**
 * `customerId`'s latest orders: placed ones, cancelled ones too (Shopify lists them, marked
 * cancelled), never drafts or test orders. Prices in the page's market.
 */
export async function loadCustomerOrders(
  tx: StoreTx,
  customerId: string,
  pricing: MarketPricing | null,
): Promise<LiquidOrderData[]> {
  const orders = await tx
    .select({
      id: order.id,
      number: order.number,
      status: order.status,
      paymentStatus: order.paymentStatus,
      fulfillmentStatus: order.fulfillmentStatus,
      totalPaise: order.totalPaise,
      subtotalPaise: order.subtotalPaise,
      shippingPaise: order.shippingPaise,
      placedAt: order.placedAt,
      importMeta: order.importMeta,
    })
    .from(order)
    .where(
      and(eq(order.customerId, customerId), ne(order.status, 'draft'), eq(order.isTest, false)),
    )
    .orderBy(desc(order.placedAt))
    .limit(CUSTOMER_ORDERS_LIMIT)
  if (orders.length === 0) return []
  const ids = orders.map((o) => o.id)
  const lines = await tx
    .select({
      id: orderLine.id,
      orderId: orderLine.orderId,
      title: orderLine.title,
      variantTitle: orderLine.variantTitle,
      quantity: orderLine.quantity,
      unitPricePaise: orderLine.unitPricePaise,
      variantId: orderLine.variantId,
      productId: product.id,
      productTitle: product.title,
      handle: product.handle,
    })
    .from(orderLine)
    .leftJoin(variant, eq(variant.id, orderLine.variantId))
    .leftJoin(product, eq(product.id, variant.productId))
    .where(inArray(orderLine.orderId, ids))
  const productIds = [...new Set(lines.flatMap((l) => (l.productId ? [l.productId] : [])))]
  const images = productIds.length
    ? await tx
        .select({ productId: productMedia.productId, url: media.url, alt: media.alt })
        .from(productMedia)
        .innerJoin(media, eq(media.id, productMedia.mediaId))
        .where(and(inArray(productMedia.productId, productIds), eq(productMedia.position, 0)))
    : []
  const ships = await tx
    .select({
      id: shipment.id,
      orderId: shipment.orderId,
      fulfillmentOrderId: shipment.fulfillmentOrderId,
      provider: shipment.provider,
      carrier: shipment.carrier,
      waybill: shipment.waybill,
      trackingUrl: shipment.trackingUrl,
      tracking: shipment.tracking,
      createdAt: shipment.createdAt,
    })
    .from(shipment)
    .where(and(inArray(shipment.orderId, ids), ne(shipment.status, 'cancelled')))
    .orderBy(desc(shipment.createdAt))
  const parcelIds = ships.flatMap((s) => (s.fulfillmentOrderId ? [s.fulfillmentOrderId] : []))
  const parcelLines = parcelIds.length
    ? await tx
        .select({
          fulfillmentOrderId: fulfillmentOrderLine.fulfillmentOrderId,
          orderLineId: fulfillmentOrderLine.orderLineId,
          quantity: fulfillmentOrderLine.quantity,
        })
        .from(fulfillmentOrderLine)
        .where(inArray(fulfillmentOrderLine.fulfillmentOrderId, parcelIds))
    : []

  return orders.map((o) => {
    const mine = lines.filter((l) => l.orderId === o.id)
    // A consignment carries its parcel's lines; one booked before parcels carries the whole order.
    const fulfillments: LiquidFulfillmentData[] = ships
      .filter((s) => s.orderId === o.id)
      .map((s) => ({
        id: s.id,
        createdAt: s.createdAt,
        trackingCompany: s.carrier ?? s.provider,
        trackingNumber: s.waybill,
        trackingUrl: s.trackingUrl ?? (s.tracking as Tracking | null)?.trackingUrl ?? null,
        lines: s.fulfillmentOrderId
          ? parcelLines
              .filter((p) => p.fulfillmentOrderId === s.fulfillmentOrderId)
              .map((p) => ({ lineId: p.orderLineId, quantity: p.quantity }))
          : mine.map((l) => ({ lineId: l.id, quantity: l.quantity })),
      }))
    const meta = o.importMeta
    return {
      id: o.id,
      number: o.number,
      name: meta?.name || `#${o.number}`,
      createdAt: o.placedAt,
      cancelled: o.status === 'cancelled',
      cancelledAt: meta?.cancelledAt ?? null,
      paymentStatus: o.paymentStatus,
      fulfillmentStatus: o.fulfillmentStatus,
      totalPrice: presentmentCents(o.totalPaise, pricing),
      subtotalPrice: presentmentCents(o.subtotalPaise, pricing),
      shippingPrice: presentmentCents(o.shippingPaise, pricing),
      lineItems: mine.map((l) => {
        const image = images.find((i) => i.productId === l.productId)
        const title = l.title ?? l.productTitle ?? ''
        return {
          id: l.id,
          title,
          variantTitle: l.variantTitle ?? '',
          quantity: l.quantity,
          price: presentmentCents(l.unitPricePaise, pricing),
          linePrice: presentmentCents(l.unitPricePaise * l.quantity, pricing),
          image: image ? { url: image.url, alt: image.alt ?? title } : null,
          url: l.handle ? `/products/${l.handle}` : null,
          // The latest consignment that carries this line.
          fulfillment: fulfillments.find((f) => f.lines.some((x) => x.lineId === l.id)) ?? null,
        }
      }),
    }
  })
}
