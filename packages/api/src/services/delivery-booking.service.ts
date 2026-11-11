import {
  assignBadges,
  type BookingContext,
  bookingPlan,
  type CourierRateRow,
  createShipmentForOrder,
  type ShippingProvider,
} from '@commerce/core'
import { fulfillmentOrder, order, type StoreTx, shipment } from '@commerce/db'
import { CourierError, describeCourierFailureForStaff } from '@commerce/shipping'
import { and, asc, eq, inArray, isNull } from 'drizzle-orm'
import { noteShipmentBooked } from './shipping.service'

/**
 * What one order books in bulk: the parcel the merchant quoted (`pinned`), else, for a cart
 * checkout split across locations (its saved `delivery.parcels`), each parcel still to ship
 * on its own (open or pre-order, not held, no live label) so each books the courier it was
 * quoted. Anything else books whole, as before: `[undefined]`.
 */
export async function parcelsToBook(
  tx: StoreTx,
  orderId: string,
  pinned: string | undefined,
): Promise<Array<string | undefined>> {
  if (pinned) return [pinned]
  const [o] = await tx.select({ shipping: order.shipping }).from(order).where(eq(order.id, orderId))
  if (!o?.shipping?.delivery?.parcels?.length) return [undefined]
  const open = await tx
    .select({ id: fulfillmentOrder.id })
    .from(fulfillmentOrder)
    .where(
      and(
        eq(fulfillmentOrder.orderId, orderId),
        inArray(fulfillmentOrder.status, ['open', 'on_hold']),
        isNull(fulfillmentOrder.heldAt),
      ),
    )
    .orderBy(asc(fulfillmentOrder.position))
  const labels = await tx
    .select({ id: shipment.fulfillmentOrderId, status: shipment.status })
    .from(shipment)
    .where(eq(shipment.orderId, orderId))
  const live = new Set(
    labels.filter((s) => s.status !== 'cancelled' && s.status !== 'rto').map((s) => s.id),
  )
  const ids = open.map((p) => p.id).filter((id) => !live.has(id))
  return ids.length > 0 ? ids : [undefined]
}

/**
 * Bulk booking with the Delivery options app: an order books exactly the route its shopper paid
 * for, through that route's own app. A failure comes back marked `needsDecision` so the merchant
 * picks a courier for that order instead of a silent swap.
 */
export async function bookSavedRoute(
  tx: StoreTx,
  storeId: string,
  providers: readonly ShippingProvider[],
  orderId: string,
  app: BookingContext,
  parcel: {
    /** Book only this parcel (`app` is then its own route: `bookingContext` with the parcel). */
    fulfillmentOrderId?: string | undefined
    weightGrams?: number | undefined
    dimensionsCm?: { length: number; width: number; height: number } | undefined
    insured?: boolean | undefined
  },
) {
  const route = app.delivery?.route
  if (!route) throw new Error('This order has no saved route.')
  const label = `${route.serviceLabel} (${route.providerId})`
  const provider = providers.find((p) => p.id === route.providerId)
  if (!provider) {
    return {
      orderId,
      ok: false,
      needsDecision: true,
      error: `${label}: this courier app is no longer connected.`,
    }
  }
  try {
    const row = await createShipmentForOrder({ storeId, tx }, provider, orderId, {
      ...parcel,
      insured: parcel.insured ?? app.delivery?.insured,
      serviceId: route.serviceId || undefined,
      serviceLabel: route.serviceLabel,
      carrier: route.carrier,
    })
    await noteShipmentBooked(tx, storeId, row.provider, orderId)
    return { orderId, ok: true, shipmentId: row.id, waybill: row.waybill, labelUrl: row.labelUrl }
  } catch (err) {
    const reason =
      err instanceof CourierError
        ? describeCourierFailureForStaff(err)
        : err instanceof Error
          ? err.message
          : String(err)
    return { orderId, ok: false, needsDecision: true, error: `${label}: ${reason}` }
  }
}

/**
 * Orders on backup or zone rates still follow the product route rules (Glasspads only with
 * Delhivery): the rows and couriers the store's courier rule may pick from. Throws when no
 * connected courier fits.
 */
export function ruleAllowedRows(
  compared: CourierRateRow[],
  providers: ShippingProvider[],
  app: BookingContext | null,
): { options: CourierRateRow[]; providers: ShippingProvider[] } {
  if (!app?.rules.length) return { options: compared, providers }
  const allowed = new Set(bookingPlan(compared, app, { insured: false }).allowedKeys)
  const options = assignBadges(compared.filter((r) => allowed.has(r.optionKey)))
  const fitting = providers.filter((p) => options.some((r) => r.providerId === p.id))
  if (fitting.length === 0) {
    throw new Error("No connected courier fits this order's product route rules.")
  }
  return { options, providers: fitting }
}
