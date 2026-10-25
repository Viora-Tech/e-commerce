/** SOURCE OF TRUTH: orderParcelsView, ParcelView, previewCartParcels
 * WHAT:  An order's parcels as people read them: where each ships from (warehouse, city,
 *        state, GSTIN), what is in it, whether it is packed, and whether it waits on a stock
 *        transfer.
 * WHY:   One order may ship in several parcels from different warehouses (order/routing.ts).
 *        The admin order page and the shopper's order pages and emails all show the same
 *        picture, so it is read in one place.
 * WHERE: admin `orders.get` (`parcels`); shopper order views and messages.
 */
import {
  cartLine,
  type FulfillmentOrderStatus,
  fulfillmentOrder,
  fulfillmentOrderLine,
  gstRegistration,
  location,
  orderLine,
  type ParcelDeliveryEstimate,
  product,
  type StoreTx,
  variant,
} from '@commerce/db'
import { asc, eq, inArray } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { resolvePreorderSettings } from '../preorder/settings'
import { INDIAN_STATE_NAMES } from '../tax/states'
import { previewRoute } from './routing-service'

export type ParcelLineView = {
  orderLineId: string
  title: string | null
  variantTitle: string | null
  quantity: number
  fulfilledQuantity: number
}

export type ParcelView = {
  id: string
  /** Parcel 1, 2, ... */
  position: number
  status: FulfillmentOrderStatus
  needsTransfer: boolean
  locationId: string
  locationName: string
  city: string | null
  stateCode: string | null
  stateName: string | null
  /** The GSTIN it is billed under; null in a store without one. */
  gstin: string | null
  totalPaise: number | null
  /** The window the shopper was told at checkout; null when none was worked out. */
  deliveryEstimate: ParcelDeliveryEstimate | null
  lines: ParcelLineView[]
}

/** The order's parcels in parcel order, cancelled ones included (they show as cancelled). */
export async function orderParcelsView(tx: StoreTx, orderId: string): Promise<ParcelView[]> {
  const parcels = await tx
    .select({
      id: fulfillmentOrder.id,
      position: fulfillmentOrder.position,
      status: fulfillmentOrder.status,
      needsTransfer: fulfillmentOrder.needsTransfer,
      totalPaise: fulfillmentOrder.totalPaise,
      deliveryEstimate: fulfillmentOrder.deliveryEstimate,
      locationId: location.id,
      locationName: location.name,
      city: location.city,
      stateCode: location.stateCode,
      gstin: gstRegistration.gstin,
    })
    .from(fulfillmentOrder)
    .innerJoin(location, eq(location.id, fulfillmentOrder.locationId))
    .leftJoin(gstRegistration, eq(gstRegistration.id, fulfillmentOrder.gstRegistrationId))
    .where(eq(fulfillmentOrder.orderId, orderId))
    .orderBy(asc(fulfillmentOrder.position))
  if (parcels.length === 0) return []
  const lines = await tx
    .select({
      fulfillmentOrderId: fulfillmentOrderLine.fulfillmentOrderId,
      orderLineId: fulfillmentOrderLine.orderLineId,
      title: orderLine.title,
      variantTitle: orderLine.variantTitle,
      quantity: fulfillmentOrderLine.quantity,
      fulfilledQuantity: fulfillmentOrderLine.fulfilledQuantity,
    })
    .from(fulfillmentOrderLine)
    .innerJoin(orderLine, eq(orderLine.id, fulfillmentOrderLine.orderLineId))
    .where(eq(orderLine.orderId, orderId))
    .orderBy(asc(orderLine.id))
  return parcels.map((p) => {
    const stateCode = p.stateCode?.trim().toUpperCase() || null
    return {
      ...p,
      stateCode,
      stateName: stateCode ? (INDIAN_STATE_NAMES[stateCode] ?? null) : null,
      lines: lines
        .filter((l) => l.fulfillmentOrderId === p.id)
        .map(({ fulfillmentOrderId: _fo, ...l }) => l),
    }
  })
}

/** A parcel as checkout previews it, before the order exists. */
export type ParcelPreview = {
  locationId: string
  locationName: string
  city: string | null
  stateCode: string | null
  stateName: string | null
  /** Where the courier collects it: the origin of its delivery estimate. Null without one. */
  pincode: string | null
  /** `on_hold`: pre-order items that ship when they arrive. */
  status: 'open' | 'on_hold'
  lines: { variantId: string; title: string; variantTitle: string | null; quantity: number }[]
}

/**
 * Where the cart would ship from to a buyer in `buyerState` (order/routing.ts, no stock held):
 * one entry per parcel. Empty when the cart cannot be routed (checkout then refuses with its
 * own message) or has no goods.
 */
export async function previewCartParcels(
  ctx: StoreContext,
  cartId: string,
  buyerState: string | null,
): Promise<ParcelPreview[]> {
  const rows = await ctx.tx
    .select({
      variantId: cartLine.variantId,
      quantity: cartLine.quantity,
      title: product.title,
      variantTitle: variant.title,
      giftCard: product.isGiftCard,
      preorderOverride: variant.preorderOverride,
      preorderEnabled: product.preorderEnabled,
      preorderShipDate: product.preorderShipDate,
      preorderShipsInDays: product.preorderShipsInDays,
      preorderLimit: product.preorderLimit,
      preorderButtonLabel: product.preorderButtonLabel,
      preorderPaymentMode: product.preorderPaymentMode,
      preorderDepositPaise: product.preorderDepositPaise,
      preorderDepositPercent: product.preorderDepositPercent,
    })
    .from(cartLine)
    .innerJoin(variant, eq(variant.id, cartLine.variantId))
    .innerJoin(product, eq(product.id, variant.productId))
    .where(eq(cartLine.cartId, cartId))
  const result = await previewRoute(ctx, {
    lines: rows.map((r, i) => {
      const pre = resolvePreorderSettings(r, r.preorderOverride)
      return {
        key: String(i),
        variantId: r.variantId,
        quantity: r.quantity,
        giftCard: r.giftCard,
        preorder: pre.enabled ? { enabled: true, limit: pre.limit } : null,
      }
    }),
    buyerState,
  })
  if (result.kind !== 'routed' || result.parcels.length === 0) return []
  const places = await ctx.tx
    .select()
    .from(location)
    .where(
      inArray(
        location.id,
        result.parcels.map((p) => p.locationId),
      ),
    )
  return result.parcels.flatMap((p) => {
    const at = places.find((l) => l.id === p.locationId)
    if (!at) return []
    const code = at.stateCode?.trim().toUpperCase() || null
    return [
      {
        locationId: at.id,
        locationName: at.name,
        city: at.city,
        stateCode: code,
        stateName: code ? (INDIAN_STATE_NAMES[code] ?? null) : null,
        pincode: at.pincode,
        status: p.status,
        lines: p.lines.flatMap((l) => {
          const row = rows[Number(l.key)]
          return row
            ? [
                {
                  variantId: row.variantId,
                  title: row.title,
                  variantTitle: row.variantTitle,
                  quantity: l.quantity,
                },
              ]
            : []
        }),
      },
    ]
  })
}
