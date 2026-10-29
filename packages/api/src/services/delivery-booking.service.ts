import {
  assignBadges,
  type BookingContext,
  bookingPlan,
  type CourierRateRow,
  createShipmentForOrder,
  type ShippingProvider,
} from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { CourierError, describeCourierFailure } from '@commerce/shipping'
import { noteShipmentBooked } from './shipping.service'

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
        ? describeCourierFailure(err)
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
