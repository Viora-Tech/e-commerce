/** SOURCE OF TRUTH: Create shipment draft shapes — WHAT: the types `prepareShipments` returns (orders, parcels, pickup places, boxes) / WHY: kept apart from the service so it stays under its size cap; `create-shipment.service.ts` re-exports them. */
import type { BoxPreset, LineAvailability } from '@commerce/core'
import type { DeliveryChoice } from './shipment-choices'

export type DimensionsCm = { length: number; width: number; height: number }

/** Where a courier can collect from: a location with courier pickup on, or (id null)
 *  Settings › Shipping's address. */
export type PickupPlace = {
  id: string | null
  name: string
  city: string | null
  pincode: string
  /** The rest of the address, for the Create shipment route card. */
  line1: string | null
  line2: string | null
  stateCode: string | null
  phone: string | null
}

export type DraftParcel = {
  /** The fulfilment order; null when the order ships whole (older orders without parcels). */
  id: string | null
  position: number
  locationName: string | null
  /** The units still to send, per order line. */
  lines: Array<{
    id: string
    title: string
    quantity: number
    /** For telling the items apart while packing. */
    imageUrl: string | null
    sku: string | null
    unitPricePaise: number
    /** One unit's weight from its variant; null when the product has none. */
    weightGrams: number | null
    /** On the shelf now, or a pre-order still waiting (Figma 916:10179's chips and ticks). */
    availability: LineAvailability
  }>
  /** Declared value: the parcel's share of the order, or the order total when it ships whole. */
  valuePaise: number
  /** The products' weights (500 g for one with none) plus the packing of the box it goes in. */
  weightGrams: number
  /** The products' own box when every line agrees on one; null uses the default box. */
  dimensionsCm: DimensionsCm | null
  /** Where it leaves from by default: the parcel's location when it has courier pickup on. */
  pickupLocationId: string | null
  /** The store's box it packs into (`parcelBoxPreset`), for the bulk table; null for none. */
  boxName: string | null
}

export type DraftOrder = {
  orderId: string
  orderNumber: number
  customerName: string | null
  city: string | null
  pincode: string | null
  /** The rest of the ship-to address, for the Create shipment route card. */
  line1: string | null
  line2: string | null
  stateCode: string | null
  phone: string | null
  paymentStatus: string
  fulfillmentStatus: string
  paymentMode: 'cod' | 'prepaid'
  /** A COD order whose shopper was asked to pay online ("Ask to pay online"), still unpaid. */
  payOnlineRequestedAt: Date | null
  totalPaise: number
  /** Why this order can't be booked here, if it can't. */
  blocked: 'no_address' | 'closed' | 'nothing_to_ship' | 'on_hold' | null
  parcels: DraftParcel[]
  /** Units on the order that need shipping, for "Ships 1 of 2 items" on a part parcel. */
  unitsOrdered: number
  /** The shopper's delivery choice at checkout; null when the order has none saved. */
  deliveryChoice: DeliveryChoice | null
}

export type ShipmentDraft = {
  couriers: Array<{ id: string; label: string; hasRates: boolean; hasPickup: boolean }>
  boxes: BoxPreset[]
  defaultBoxId: string | null
  pickupPlaces: PickupPlace[]
  orders: DraftOrder[]
  /** Settings › Shipping: shipping insurance starts switched on in Create shipment. */
  insureByDefault: boolean
}
