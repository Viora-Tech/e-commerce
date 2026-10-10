/** SOURCE OF TRUTH: setLocationCourierPickup, shipFromFor, PICKUP_NEEDS_ADDRESS
 * WHAT:  Where a courier collects an order's parcel (and brings a return back to): the
 *        location the order's goods sell from, when that location has courier pickup on;
 *        otherwise the store-wide return address in Settings › Shipping
 *        (`store.shipping.policy.warehouse` + `originPincode`), exactly as before.
 * WHY:   With warehouses in more than one state (GST phase 3) a parcel leaves from the
 *        warehouse that billed it. Pickup is opt-in per location so a store that never set it
 *        up books exactly as it did. PICKUP_NEEDS_ADDRESS: a location must have line 1, city,
 *        state and PIN code before couriers can collect from it.
 * WHERE: Settings › Locations (`businessGst.setLocationPickup`); `bookShipment` and return
 *        pickups read `shipFromFor`.
 */
import {
  type LocationCourierPickup,
  location,
  type OrderTaxOrigin,
  type StoreTx,
} from '@commerce/db'
import type { ShipmentAddress } from '@commerce/shipping'
import { eq } from 'drizzle-orm'
import {
  LocationCourierPickupSchema,
  type LocationPickupInput,
  LocationPickupInputSchema,
} from '../tax/registration-schemas'
import { GstRegistrationError } from '../tax/registrations'
import type { parseShippingSettings } from './settings'

type LocationRow = typeof location.$inferSelect

/** PICKUP_NEEDS_ADDRESS: what a courier needs to find the place. */
function hasPickupAddress(
  l: Pick<LocationRow, 'line1' | 'city' | 'stateCode' | 'pincode'>,
): boolean {
  return Boolean(l.line1?.trim() && l.city?.trim() && l.stateCode?.trim() && l.pincode?.trim())
}

/** Turn courier pickup on (with the names the courier knows it by) or off for one location. */
export async function setLocationCourierPickup(
  tx: StoreTx,
  storeId: string,
  raw: LocationPickupInput,
): Promise<LocationCourierPickup | null> {
  const input = LocationPickupInputSchema.parse(raw)
  const [loc] = await tx.select().from(location).where(eq(location.id, input.locationId))
  if (!loc) throw new GstRegistrationError('NOT_FOUND', 'Location not found', storeId)
  const pickup = input.pickup ? LocationCourierPickupSchema.parse(input.pickup) : null
  if (pickup && !hasPickupAddress(loc)) {
    throw new GstRegistrationError(
      'ADDRESS_INCOMPLETE',
      'Add this location’s full address (line 1, city, state and PIN code) before couriers collect from it.',
      storeId,
    )
  }
  await tx.update(location).set({ courierPickup: pickup }).where(eq(location.id, loc.id))
  return pickup
}

export type ShipFrom = {
  address: ShipmentAddress
  /** The courier's registered pickup location name; null uses the courier account's own. */
  pickupLocationName: string | null
  /** The location parcels leave from; null when the store-wide address is used. */
  locationId: string | null
}

type ShippingSettings = ReturnType<typeof parseShippingSettings>

/** Settings › Shipping's return address: what every booking used before per-location pickup. */
function storeWide(settings: ShippingSettings, storeName: string): ShipFrom {
  const w = settings.policy.warehouse
  return {
    address: {
      name: w.name || storeName,
      line1: w.line1,
      line2: w.line2 || undefined,
      city: w.city,
      state: w.state,
      pincode: settings.policy.originPincode,
      country: 'IN',
      phone: w.phone,
    },
    pickupLocationName: null,
    locationId: null,
  }
}

/**
 * Where the courier collects a parcel: `locationId` (the parcel's location, or for a return the
 * one its goods left from), else the order's tax origin (older orders: the default location),
 * when courier pickup is on there and its address is complete; else the store-wide return
 * address.
 */
export async function shipFromFor(
  tx: StoreTx,
  input: {
    taxOrigin: OrderTaxOrigin | null
    /** The parcel's own location; wins over the order's tax origin. */
    locationId?: string | null | undefined
    settings: ShippingSettings
    storeName: string
  },
): Promise<ShipFrom> {
  const id = input.locationId ?? input.taxOrigin?.locationId ?? null
  const [loc] = await tx
    .select()
    .from(location)
    .where(id ? eq(location.id, id) : eq(location.isDefault, true))
  const pickup = loc?.courierPickup
  if (!loc || !pickup || !hasPickupAddress(loc)) return storeWide(input.settings, input.storeName)
  return {
    address: {
      name: pickup.contactName || loc.name,
      line1: loc.line1 ?? '',
      line2: loc.line2 || undefined,
      city: loc.city ?? '',
      state: loc.stateCode ?? '',
      pincode: loc.pincode ?? '',
      country: loc.country || 'IN',
      phone: pickup.phone || loc.phone || input.settings.policy.warehouse.phone,
    },
    pickupLocationName: pickup.pickupName || null,
    locationId: loc.id,
  }
}
