/** SOURCE OF TRUTH: courier app overview, courier pickup locations — WHAT: one courier's Overview tiles (courierActivity) and the pickup locations its parcels leave from, each with its next booked pickup / WHY: a courier app (Delhivery · Overview, Pickup locations) shows only its own parcels and places */
import { type CourierActivity, courierActivity } from '@commerce/core'
import { dayKey } from '@commerce/dates'
import { location, type StoreTx, shipmentPickup } from '@commerce/db'
import { and, asc, eq, gte, inArray, isNotNull } from 'drizzle-orm'
import { loadShippingSettings } from './shipping.service'

/** One courier's numbers for its Overview tiles, in this store only. */
export function courierOverview(
  tx: StoreTx,
  storeId: string,
  provider: string,
  now: Date = new Date(),
): Promise<CourierActivity> {
  return courierActivity(tx, storeId, provider, now)
}

/** A pickup booked with the courier from today on: the next one per place. */
export type NextPickup = { date: string; timeFrom: string; parcels: number }

/** A place the courier collects this store's parcels from, as the Pickup locations card lists it. */
export type CourierPickupPlace = {
  /** The location's id; null for the courier account's own (the Connect page's pickup location). */
  locationId: string | null
  /** The name registered on the courier's dashboard; what a booking sends. */
  pickupName: string
  /** The store's own name for the place (the location, or Settings › Shipping's return address). */
  label: string
  city: string | null
  pincode: string | null
  /** The one a booking without a location of its own uses. */
  isDefault: boolean
  nextPickup: NextPickup | null
}

/**
 * The pickup locations a courier collects this store's parcels from: the courier account's own
 * (its Connect page's pickup location name, at Settings › Shipping's address) first, then every
 * location with courier pickup on (Settings › Locations), each with the next pickup booked there.
 * Locations share one registered name across couriers (`location.courier_pickup.pickupName`).
 */
export async function courierPickupPlaces(
  tx: StoreTx,
  storeId: string,
  provider: string,
  now: Date = new Date(),
): Promise<CourierPickupPlace[]> {
  const settings = await loadShippingSettings(tx, storeId)
  const ownName = settings.providers[provider]?.pickupLocationName?.trim() ?? ''
  const warehouse = settings.policy.warehouse
  const places = await tx
    .select({
      id: location.id,
      name: location.name,
      city: location.city,
      pincode: location.pincode,
      pickup: location.courierPickup,
    })
    .from(location)
    .where(and(eq(location.storeId, storeId), isNotNull(location.courierPickup)))
    .orderBy(location.name)
  const pickups = await tx
    .select({
      place: shipmentPickup.pickupLocationName,
      date: shipmentPickup.scheduledFor,
      timeFrom: shipmentPickup.timeFrom,
      parcels: shipmentPickup.expectedPackageCount,
    })
    .from(shipmentPickup)
    .where(
      and(
        eq(shipmentPickup.storeId, storeId),
        eq(shipmentPickup.provider, provider),
        inArray(shipmentPickup.status, ['scheduled', 'requested']),
        gte(shipmentPickup.scheduledFor, dayKey(now)),
      ),
    )
    .orderBy(asc(shipmentPickup.scheduledFor), asc(shipmentPickup.timeFrom))
  const nextAt = (name: string): NextPickup | null => {
    const p = pickups.find((r) => (r.place ?? '') === name)
    return p ? { date: p.date, timeFrom: p.timeFrom, parcels: p.parcels } : null
  }
  const ownPickupName = ownName || warehouse.name
  const own: CourierPickupPlace = {
    locationId: null,
    pickupName: ownPickupName,
    label: warehouse.name || ownPickupName,
    city: warehouse.city || null,
    pincode: settings.policy.originPincode || null,
    isDefault: true,
    nextPickup: nextAt(ownPickupName),
  }
  return [
    ...(ownPickupName ? [own] : []),
    ...places.map((l) => {
      const pickupName = l.pickup?.pickupName.trim() || l.name
      return {
        locationId: l.id,
        pickupName,
        label: l.name,
        city: l.city,
        pincode: l.pincode,
        isDefault: false,
        nextPickup: nextAt(pickupName),
      }
    }),
  ]
}
