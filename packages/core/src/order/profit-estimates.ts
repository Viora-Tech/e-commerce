/** SOURCE OF TRUTH: parcelCost, DELIVERY_ESTIMATE, buildDeliveryRates, estimateDelivery
 * WHAT:  What packing and delivery cost one parcel of an order, real when known and a cautious
 *        estimate until then. Pure, no database: safe for client components.
 * WHY:   A fresh order used to show courier ₹0 and no packing at all, so it read better than it
 *        would end up (design: docs/superpowers/specs/2026-10-22-profit-design.md §1, §2).
 *        PARCEL_COSTS, per parcel (fulfilment order; an order older than parcels is one):
 *          packing  = the consignment's snapshot (box cost when it was booked or packed), else
 *                     the parcel's box cost now (estimated); a box with no cost, or no box at
 *                     all, counts ₹0 and is flagged "packing cost not set"
 *          delivery = what the courier charged each live consignment, else an estimate:
 *                     1. the highest real charge in the last 60 days for that courier and
 *                        destination state (any courier, when none is booked yet and the store
 *                        has none switched on);
 *                     2. else the store's default delivery cost per parcel (₹100 out of the box)
 *          No estimate for a parcel of a cancelled order that was never booked, a parcel that
 *          was cancelled, one with nothing to ship (gift cards) or an order with no address to
 *          ship to. A cancelled consignment keeps its packing; its charge does not count
 *          (couriers reverse a cancelled booking).
 * WHERE: order/profit-parcels.ts loads the facts; order/profit.ts sums the parcels.
 */

/** How far back real charges are looked at for a delivery estimate. */
export const DELIVERY_LOOKBACK_DAYS = 60
/** The default delivery cost per parcel until the store sets its own: ₹100. */
export const DEFAULT_DELIVERY_PAISE = 10_000

/** Highest real charge by `courier|state`, and by `*|state` across every courier. */
export type DeliveryRates = ReadonlyMap<string, number>

const ANY_COURIER = '*'
const rateKey = (courier: string, state: string) => `${courier}|${state.toUpperCase()}`

/** The rate table from real charges (one row per consignment or already grouped). */
export function buildDeliveryRates(
  rows: readonly { provider: string; stateCode: string | null; chargePaise: number }[],
): DeliveryRates {
  const out = new Map<string, number>()
  const keep = (key: string, paise: number) => out.set(key, Math.max(out.get(key) ?? 0, paise))
  for (const r of rows) {
    if (!r.stateCode || r.chargePaise <= 0) continue
    keep(rateKey(r.provider, r.stateCode), r.chargePaise)
    keep(rateKey(ANY_COURIER, r.stateCode), r.chargePaise)
  }
  return out
}

/**
 * The cautious delivery estimate for one parcel: that courier's highest charge to the state,
 * else (no courier known) any courier's, else the store's default.
 */
export function estimateDelivery(
  rates: DeliveryRates,
  courier: string | null,
  stateCode: string | null,
  defaultPaise: number,
): number {
  if (stateCode) {
    const found = rates.get(rateKey(courier ?? ANY_COURIER, stateCode))
    if (found !== undefined) return found
  }
  return defaultPaise
}

/** One consignment of a parcel, as profit reads it. */
export type ParcelShipment = {
  provider: string
  cancelled: boolean
  courierChargePaise: number | null
  packingCostPaise: number | null
}

/** One parcel's facts (PARCEL_COSTS). */
export type ParcelFacts = {
  /** Holds something to ship (not only gift cards). */
  shippable: boolean
  /** The parcel itself was cancelled. */
  cancelled: boolean
  /** Its box's cost now; null when there is no box or the box has no cost set. */
  boxCostPaise: number | null
  /** Consignments, oldest first. */
  shipments: readonly ParcelShipment[]
}

/** What the order around the parcels says. */
export type ParcelOrderContext = {
  orderCancelled: boolean
  /** The order has an address to ship to. */
  shipsToAddress: boolean
  stateCode: string | null
  /** The courier a not-yet-booked parcel would go with (the store's first), if any. */
  defaultCourier: string | null
  rates: DeliveryRates
  defaultDeliveryPaise: number
}

/** One parcel's packing and delivery, and where each came from. */
export type ParcelCost = {
  packingPaise: number
  /** Box cost now, not a snapshot taken at booking or packing. */
  packingEstimated: boolean
  /** No box, or a box with no cost: counted as ₹0. */
  packingMissing: boolean
  courierPaise: number
  /** Some or all of the delivery is an estimate. */
  courierEstimated: boolean
}

/** PARCEL_COSTS for one parcel; null when the parcel costs nothing at all. */
export function parcelCost(p: ParcelFacts, ctx: ParcelOrderContext): ParcelCost | null {
  const booked = p.shipments.length > 0
  const eligible = p.shippable && !p.cancelled && ctx.shipsToAddress && !ctx.orderCancelled
  if (!booked && !eligible) return null

  const snapshot = [...p.shipments].reverse().find((s) => s.packingCostPaise !== null)
  const packingPaise = snapshot?.packingCostPaise ?? p.boxCostPaise ?? 0
  const packingEstimated = !snapshot && p.boxCostPaise !== null
  const packingMissing = !snapshot && p.boxCostPaise === null

  const live = p.shipments.filter((s) => !s.cancelled)
  let courierPaise = 0
  let courierEstimated = false
  const estimate = (courier: string | null) =>
    estimateDelivery(ctx.rates, courier, ctx.stateCode, ctx.defaultDeliveryPaise)
  if (live.length > 0) {
    for (const s of live) {
      if (s.courierChargePaise !== null) courierPaise += Math.max(0, s.courierChargePaise)
      else {
        courierPaise += estimate(s.provider)
        courierEstimated = true
      }
    }
  } else if (eligible) {
    courierPaise = estimate(ctx.defaultCourier)
    courierEstimated = true
  }
  return { packingPaise, packingEstimated, packingMissing, courierPaise, courierEstimated }
}
