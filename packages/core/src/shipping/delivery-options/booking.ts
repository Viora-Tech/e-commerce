/** SOURCE OF TRUTH: booking a delivery option order — WHAT: reads the route saved on an order,
 * finds it among the Create shipment rate rows (marked "Chosen at checkout"), says why it
 * cannot be booked when it cannot, and names the fallback: the next route by the option's
 * strategy among those that still fit (product rule pool, insurance, COD, same or faster
 * speed) / WHY: what the merchant pays the courier must match what the shopper was charged
 * for, and a failed route must never be swapped for another one silently.
 */
import {
  fulfillmentOrder,
  type OrderDeliveryRoute,
  type OrderShippingSnapshot,
  order,
  orderLine,
  orderNote,
  type StoreTx,
  shipment,
  variant,
} from '@commerce/db'
import { and, asc, eq } from 'drizzle-orm'
import type { StoreContext } from '../../context'
import { orderParcelsView, type ParcelView } from '../../order/parcel-view'
import type { CourierRateRow } from '../courier-rates'
import type { DeliveryOption, RouteSetting } from './config'
import { type ProviderAnswer, type Route, routeKey, routesFromAnswers } from './routes'
import { matchingRules, poolAllows, type RulePool, rulePool } from './rules'
import { activeDeliveryConfig, productFacts } from './service'

/** The route an order saved at checkout, if it was placed with the Delivery options app. */
function orderDeliveryRoute(
  shipping: OrderShippingSnapshot | null | undefined,
): OrderDeliveryRoute | null {
  return shipping?.delivery ?? null
}

/** The order page's parcels (`orderParcelsView`) with each one's booking charge, for its margin. */
export async function orderParcelsWithCharges(
  tx: StoreTx,
  orderId: string,
  shipping: OrderShippingSnapshot | null | undefined,
): Promise<{
  parcels: ParcelView[]
  parcelCourierCharges: Record<string, number>
  parcelInsuranceCosts: Record<string, number>
}> {
  const parcels = await orderParcelsView(tx, orderId)
  const booked = await parcelBookings(tx, orderId, shipping)
  return { parcels, parcelCourierCharges: booked.charges, parcelInsuranceCosts: booked.insurance }
}

/**
 * Each parcel's own booking charge and insurance cost (fulfilment order id -> paise, the latest
 * label that was not cancelled), so a split cart's shipping margin adds up every parcel
 * (`shippingMargin`). Empty for an order without parcel routes.
 */
async function parcelBookings(
  tx: StoreTx,
  orderId: string,
  shipping: OrderShippingSnapshot | null | undefined,
): Promise<{ charges: Record<string, number>; insurance: Record<string, number> }> {
  if (!shipping?.delivery?.parcels?.length) return { charges: {}, insurance: {} }
  const rows = await tx
    .select({
      parcelId: shipment.fulfillmentOrderId,
      chargePaise: shipment.courierChargePaise,
      insurancePaise: shipment.insurancePaise,
      status: shipment.status,
    })
    .from(shipment)
    .where(eq(shipment.orderId, orderId))
    .orderBy(asc(shipment.createdAt))
  const charges: Record<string, number> = {}
  const insurance: Record<string, number> = {}
  for (const r of rows) {
    if (!r.parcelId || r.status === 'cancelled') continue
    if (r.chargePaise !== null) charges[r.parcelId] = r.chargePaise
    if (r.insurancePaise !== null) insurance[r.parcelId] = r.insurancePaise
  }
  return { charges, insurance }
}

/** A fulfilment order as booking matches it to a saved parcel route. */
export type ParcelRef = { id?: string | null | undefined; locationId: string; status: string }

/**
 * The route to book for one parcel of the order: the courier checkout quoted for that parcel
 * (the route stamped with its fulfilment order id; else matched by its location, a pre-order
 * parcel to the pre-order one first), else the order's route. Booking the whole order, or an
 * order with one parcel, is the order's route unchanged. The id match keeps a released
 * pre-order parcel on its own route when its location also has an in-stock parcel.
 */
export function deliveryForParcel(
  delivery: OrderDeliveryRoute | null,
  parcel: ParcelRef | null | undefined,
): OrderDeliveryRoute | null {
  if (!delivery?.parcels?.length || !parcel) return delivery
  const byId = parcel.id
    ? delivery.parcels.find((p) => p.fulfillmentOrderId === parcel.id)
    : undefined
  const here = delivery.parcels.filter((p) => p.locationId === parcel.locationId)
  const own = byId ?? here.find((p) => p.onHold === (parcel.status === 'on_hold')) ?? here[0]
  if (!own) return delivery
  const { locationId: _l, onHold: _h, fulfillmentOrderId: _f, ...route } = own
  return { ...delivery, ...route }
}

/**
 * Stamp each saved parcel route with the fulfilment order placing made for it (same location,
 * pre-order with pre-order), each used once. Unchanged (same object) when there is nothing to
 * stamp, so callers can skip the write.
 */
export function withParcelIds(
  delivery: OrderDeliveryRoute | null | undefined,
  made: readonly ParcelRef[],
): OrderDeliveryRoute | null | undefined {
  if (!delivery?.parcels?.length) return delivery
  const taken = new Set<string>()
  let changed = false
  const parcels = delivery.parcels.map((p) => {
    if (p.fulfillmentOrderId) return p
    const fo = made.find(
      (m) =>
        m.id &&
        !taken.has(m.id) &&
        m.locationId === p.locationId &&
        (m.status === 'on_hold') === p.onHold,
    )
    if (!fo?.id) return p
    taken.add(fo.id)
    changed = true
    return { ...p, fulfillmentOrderId: fo.id }
  })
  return changed ? { ...delivery, parcels } : delivery
}

/** Save the new parcels' ids on the order's parcel routes (`withParcelIds`); no-op without. */
export async function saveParcelIds(
  tx: StoreTx,
  orderId: string,
  made: readonly ParcelRef[],
): Promise<void> {
  const [o] = await tx.select({ shipping: order.shipping }).from(order).where(eq(order.id, orderId))
  const delivery = o?.shipping?.delivery
  const stamped = withParcelIds(delivery, made)
  if (!o?.shipping || !stamped || stamped === delivery) return
  await tx
    .update(order)
    .set({ shipping: { ...o.shipping, delivery: stamped } })
    .where(eq(order.id, orderId))
}

/** What a Create shipment rate row is as a route (carrier, channel, speed, insures). */
export function rowRoute(row: CourierRateRow, settings: readonly RouteSetting[]): Route | null {
  const answer: ProviderAnswer = {
    providerId: row.providerId,
    providerLabel: row.providerName,
    status: 'ok',
    source: 'live',
    ms: null,
    error: null,
    serviceable: row.problem !== 'not_serviceable',
    services: [
      {
        serviceId: row.serviceId ?? '',
        serviceLabel: row.serviceLabel ?? row.providerName,
        carrier: row.carrier ?? null,
        pricePaise: row.pricePaise,
        codPricePaise: null,
        insurancePaise: null,
        minTransitDays: row.minTransitDays,
        maxTransitDays: row.maxTransitDays,
        codAvailable: row.codAvailable,
      },
    ],
  }
  return routesFromAnswers([answer], settings, 500)[0] ?? null
}

export type BookingContext = {
  delivery: OrderDeliveryRoute | null
  option: DeliveryOption | null
  rules: RulePool['applied']
  settings: RouteSetting[]
}

/**
 * The app's facts for booking one order: its saved route and option, the product route rules
 * its items match, and the route settings. Null when the app is off for the store.
 */
export async function bookingContext(
  tx: StoreTx,
  storeId: string,
  orderId: string,
  fulfillmentOrderId?: string | null,
): Promise<BookingContext | null> {
  const config = await activeDeliveryConfig(tx, storeId)
  if (!config) return null
  const [o] = await tx.select({ shipping: order.shipping }).from(order).where(eq(order.id, orderId))
  // Booking one parcel of a split cart: the courier quoted for that parcel.
  const [parcel] = fulfillmentOrderId
    ? await tx
        .select({
          id: fulfillmentOrder.id,
          locationId: fulfillmentOrder.locationId,
          status: fulfillmentOrder.status,
        })
        .from(fulfillmentOrder)
        .where(
          and(eq(fulfillmentOrder.id, fulfillmentOrderId), eq(fulfillmentOrder.orderId, orderId)),
        )
    : []
  const delivery = deliveryForParcel(orderDeliveryRoute(o?.shipping), parcel)
  const lines = await tx
    .select({ productId: variant.productId })
    .from(orderLine)
    .innerJoin(variant, eq(variant.id, orderLine.variantId))
    .where(eq(orderLine.orderId, orderId))
  const items = await productFacts(tx, [...new Set(lines.map((l) => l.productId))])
  const option = delivery ? (config.options.find((x) => x.id === delivery.optionId) ?? null) : null
  // An order from before the app (or on zone rates) still follows rules meant for every option.
  const rules = option
    ? matchingRules(config.rules, option.id, items)
    : matchingRules(
        config.rules.filter((r) => r.optionIds === 'all'),
        '',
        items,
      )
  return { delivery, option, rules, settings: config.routeSettings }
}

export type BookingPlan = {
  /** The row of the route saved at checkout, when it can still be booked. */
  chosenKey: string | null
  /** Why the saved route cannot be booked: the courier's reason, or `not_offered`. */
  chosenProblem: string | null
  /** The next route by the option's strategy that still fits the order. */
  fallbackKey: string | null
  /** Rows the product route rules (and insurance) allow. */
  allowedKeys: string[]
}

const rowMatches = (row: CourierRateRow, key: string) =>
  routeKey(row.providerId, row.serviceId ?? '') === key

/** Find the saved route among the rate rows, and the fallback when it cannot be booked. */
export function bookingPlan(
  rows: readonly CourierRateRow[],
  ctx: BookingContext,
  opts: { insured: boolean },
): BookingPlan {
  const candidates = rows.flatMap((row) => {
    const route = rowRoute(row, ctx.settings)
    return route ? [{ row, route }] : []
  })
  const pool = rulePool(
    ctx.rules,
    candidates.map((c) => c.route),
  )
  const speed = ctx.option?.speed ?? null
  const allowed = candidates.filter(
    ({ row, route }) =>
      row.problem === null &&
      poolAllows(pool, route) &&
      (!opts.insured || route.insures) &&
      (speed !== 'express' || route.speed === 'express'),
  )
  const saved = ctx.delivery?.route ?? null
  const chosen = saved ? rows.find((r) => rowMatches(r, saved.key)) : undefined
  const chosenOk = chosen && chosen.problem === null ? chosen : null
  const strategy = ctx.option?.strategy ?? 'cheapest'
  const price = (r: CourierRateRow) => r.pricePaise ?? Number.MAX_SAFE_INTEGER
  const ranked = allowed
    .map((c) => c.row)
    .filter((r) => r !== chosen)
    .sort((a, b) =>
      strategy === 'fastest'
        ? (a.deliveryBy ?? '9999').localeCompare(b.deliveryBy ?? '9999') || price(a) - price(b)
        : price(a) - price(b),
    )
  return {
    chosenKey: chosenOk?.optionKey ?? null,
    chosenProblem:
      !saved || chosenOk ? null : chosen ? (chosen.problemDetail ?? chosen.problem) : 'not_offered',
    fallbackKey: saved && !chosenOk ? (ranked[0]?.optionKey ?? null) : null,
    allowedKeys: allowed.map((c) => c.row.optionKey),
  }
}

/**
 * The merchant booked another route on purpose (another row in Create shipment, or a courier
 * picked for the order in bulk): the order's timeline says which, against the route the shopper
 * paid for, so shipping cost and promise questions have an answer later.
 */
export async function noteOffRoute(
  ctx: StoreContext,
  orderId: string,
  route: NonNullable<OrderDeliveryRoute['route']>,
  bookedWith: string,
  bookedService: string | undefined,
): Promise<void> {
  const booked = [bookedService?.trim(), `via ${bookedWith}`].filter(Boolean).join(' ')
  await ctx.tx.insert(orderNote).values({
    storeId: ctx.storeId,
    orderId,
    body: `Booked ${booked} instead of the route chosen at checkout: ${route.carrier} ${route.serviceLabel} via ${route.providerId}.`,
    author: null,
  })
}
