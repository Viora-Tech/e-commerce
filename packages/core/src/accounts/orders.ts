import {
  address,
  media,
  order,
  orderLine,
  payment,
  product,
  productMedia,
  refund,
  shipment,
  variant,
} from '@commerce/db'
import type { Tracking, TrackingEvent } from '@commerce/shipping'
import { and, asc, desc, eq, inArray, isNull, ne } from 'drizzle-orm'
import type { StoreContext } from '../context'
import type { GstBreakdown } from '../tax/gst'

/**
 * What a signed-in shopper can see of their own orders. Every query is filtered
 * by `customer_id` on top of RLS, so one customer never reads another's orders
 * even inside the same store. Drafts are the merchant's and never listed.
 */

export type ShopperPaymentState = 'paid' | 'pending' | 'cod' | 'refunded' | 'failed'
export type ShopperShipmentState =
  | 'unfulfilled'
  | 'created'
  | 'picked_up'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'rto'
  | 'cancelled'

export type ShopperOrderSummary = {
  id: string
  number: number
  placedAt: Date
  status: 'placed' | 'paid' | 'fulfilled' | 'delivered' | 'cancelled'
  totalPaise: number
  itemCount: number
  payment: ShopperPaymentState
  shipment: ShopperShipmentState
  firstImage: { url: string; alt: string | null } | null
}

type PaymentRow = { provider: string; status: string }

/** One word for the money side, as the shopper would put it. */
export function paymentState(
  p: PaymentRow | undefined,
  method: string | null,
  refunded: boolean,
): ShopperPaymentState {
  if (refunded || p?.status === 'refunded') return 'refunded'
  if (p?.status === 'captured') return 'paid'
  if (p?.status === 'failed') return 'failed'
  if ((p?.provider ?? method) === 'cod') return 'cod'
  return 'pending'
}

const shipmentState = (s: { status: string } | undefined): ShopperShipmentState =>
  (s?.status as ShopperShipmentState | undefined) ?? 'unfulfilled'

export async function listCustomerOrders(
  ctx: StoreContext,
  customerId: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<ShopperOrderSummary[]> {
  const rows = await ctx.tx
    .select()
    .from(order)
    .where(and(eq(order.customerId, customerId), ne(order.status, 'draft')))
    .orderBy(desc(order.placedAt))
    .limit(opts.limit ?? 50)
    .offset(opts.offset ?? 0)
  return summarise(ctx, rows)
}

async function summarise(
  ctx: StoreContext,
  rows: (typeof order.$inferSelect)[],
): Promise<ShopperOrderSummary[]> {
  if (rows.length === 0) return []
  const ids = rows.map((r) => r.id)
  const [lines, pays, ships, refunds] = await Promise.all([
    ctx.tx
      .select({
        orderId: orderLine.orderId,
        quantity: orderLine.quantity,
        productId: variant.productId,
      })
      .from(orderLine)
      .innerJoin(variant, eq(variant.id, orderLine.variantId))
      .where(inArray(orderLine.orderId, ids)),
    ctx.tx.select().from(payment).where(inArray(payment.orderId, ids)),
    ctx.tx.select().from(shipment).where(inArray(shipment.orderId, ids)),
    ctx.tx.select({ orderId: refund.orderId }).from(refund).where(inArray(refund.orderId, ids)),
  ])
  const productIds = [...new Set(lines.map((l) => l.productId))]
  const images = productIds.length
    ? await ctx.tx
        .select({ productId: productMedia.productId, url: media.url, alt: media.alt })
        .from(productMedia)
        .innerJoin(media, eq(media.id, productMedia.mediaId))
        .where(and(inArray(productMedia.productId, productIds), eq(productMedia.position, 0)))
    : []
  return rows.map((o) => {
    const mine = lines.filter((l) => l.orderId === o.id)
    const img = images.find((i) => mine.some((l) => l.productId === i.productId))
    return {
      id: o.id,
      number: o.number,
      placedAt: o.placedAt,
      status: o.status as ShopperOrderSummary['status'],
      totalPaise: o.totalPaise,
      itemCount: mine.reduce((n, l) => n + l.quantity, 0),
      payment: paymentState(
        pays.find((p) => p.orderId === o.id),
        o.paymentMethod,
        refunds.some((r) => r.orderId === o.id),
      ),
      shipment: shipmentState(ships.find((s) => s.orderId === o.id)),
      firstImage: img ? { url: img.url, alt: img.alt } : null,
    }
  })
}

export type ShopperOrderLine = {
  id: string
  variantId: string
  productHandle: string | null
  title: string
  variantTitle: string | null
  quantity: number
  unitPricePaise: number
  linePaise: number
  imageUrl: string | null
  /** False when the product was archived or the variant removed; reorder skips it. */
  purchasable: boolean
}

export type ShopperOrderDetail = ShopperOrderSummary & {
  subtotalPaise: number
  shippingPaise: number
  discountPaise: number
  discountLabel: string | null
  paymentAdjustmentPaise: number
  paymentAdjustmentLabel: string | null
  taxPaise: number
  gst: GstBreakdown | null
  paymentMethod: string | null
  email: string | null
  phone: string | null
  address: {
    name: string
    line1: string
    line2: string | null
    city: string
    stateCode: string
    pincode: string
    phone: string
  } | null
  lines: ShopperOrderLine[]
  tracking: {
    waybill: string
    provider: string
    trackingUrl: string | null
    expectedDate: string | null
    /** Newest first, for the timeline. */
    events: TrackingEvent[]
  } | null
}

const isGst = (v: unknown): v is GstBreakdown =>
  typeof v === 'object' && v !== null && typeof (v as GstBreakdown).taxPaise === 'number'

/** One order by its number, only if it belongs to this customer. */
export async function getCustomerOrder(
  ctx: StoreContext,
  customerId: string,
  number: number,
): Promise<ShopperOrderDetail | null> {
  if (!Number.isInteger(number) || number < 1) return null
  const [o] = await ctx.tx
    .select()
    .from(order)
    .where(
      and(eq(order.number, number), eq(order.customerId, customerId), ne(order.status, 'draft')),
    )
  if (!o) return null
  const [summary] = await summarise(ctx, [o])
  const lines = await ctx.tx
    .select({
      id: orderLine.id,
      variantId: orderLine.variantId,
      title: orderLine.title,
      variantTitle: orderLine.variantTitle,
      quantity: orderLine.quantity,
      unitPricePaise: orderLine.unitPricePaise,
      productId: variant.productId,
      productHandle: product.handle,
      productStatus: product.status,
      archivedAt: variant.archivedAt,
      variantImage: media.url,
    })
    .from(orderLine)
    .innerJoin(variant, eq(variant.id, orderLine.variantId))
    .innerJoin(product, eq(product.id, variant.productId))
    .leftJoin(media, eq(media.id, variant.mediaId))
    .where(eq(orderLine.orderId, o.id))
    .orderBy(asc(orderLine.id))
  const productIds = [...new Set(lines.map((l) => l.productId))]
  const images = productIds.length
    ? await ctx.tx
        .select({ productId: productMedia.productId, url: media.url })
        .from(productMedia)
        .innerJoin(media, eq(media.id, productMedia.mediaId))
        .where(and(inArray(productMedia.productId, productIds), eq(productMedia.position, 0)))
    : []
  const [addr] = o.shippingAddressId
    ? await ctx.tx.select().from(address).where(eq(address.id, o.shippingAddressId))
    : []
  const [ship] = await ctx.tx
    .select()
    .from(shipment)
    .where(eq(shipment.orderId, o.id))
    .orderBy(desc(shipment.createdAt))
  const tracking = ship?.tracking as Tracking | null | undefined

  return {
    ...(summary as ShopperOrderSummary),
    subtotalPaise: o.subtotalPaise,
    shippingPaise: o.shippingPaise,
    discountPaise: o.discountPaise,
    discountLabel: o.discountLabel ?? o.discountCode,
    paymentAdjustmentPaise: o.paymentAdjustmentPaise,
    paymentAdjustmentLabel: o.paymentAdjustmentLabel,
    taxPaise: o.taxPaise,
    gst: isGst(o.taxBreakdown) ? o.taxBreakdown : null,
    paymentMethod: o.paymentMethod,
    email: o.email,
    phone: o.phone,
    address: addr
      ? {
          name: addr.name,
          line1: addr.line1,
          line2: addr.line2,
          city: addr.city,
          stateCode: addr.stateCode,
          pincode: addr.pincode,
          phone: addr.phone,
        }
      : null,
    lines: lines.map((l) => ({
      id: l.id,
      variantId: l.variantId,
      productHandle: l.productStatus === 'active' ? l.productHandle : null,
      title: l.title ?? '',
      variantTitle: l.variantTitle,
      quantity: l.quantity,
      unitPricePaise: l.unitPricePaise,
      linePaise: l.unitPricePaise * l.quantity,
      imageUrl: l.variantImage ?? images.find((i) => i.productId === l.productId)?.url ?? null,
      purchasable: l.productStatus === 'active' && l.archivedAt === null,
    })),
    tracking: ship
      ? {
          waybill: ship.waybill,
          provider: ship.provider,
          trackingUrl: ship.trackingUrl ?? tracking?.trackingUrl ?? null,
          expectedDate: tracking?.expectedDate ?? null,
          events: [...(tracking?.events ?? [])].reverse(),
        }
      : null,
  }
}

/** Variant ids and quantities to put back in the cart for "Buy again". */
export async function reorderLines(
  ctx: StoreContext,
  customerId: string,
  number: number,
): Promise<{ variantId: string; quantity: number }[]> {
  const detail = await getCustomerOrder(ctx, customerId, number)
  if (!detail) return []
  const live = await ctx.tx
    .select({ id: variant.id })
    .from(variant)
    .where(
      and(
        inArray(
          variant.id,
          detail.lines.map((l) => l.variantId),
        ),
        isNull(variant.archivedAt),
      ),
    )
  return detail.lines
    .filter((l) => l.purchasable && live.some((v) => v.id === l.variantId))
    .map((l) => ({ variantId: l.variantId, quantity: l.quantity }))
}
