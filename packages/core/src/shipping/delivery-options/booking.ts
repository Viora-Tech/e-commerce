/**
 * SOURCE OF TRUTH: booking a delivery option order — WHAT: reads the route saved on an order,
 * finds it among the Create shipment rate rows (marked "Chosen at checkout"), says why it
 * cannot be booked when it cannot, and names the fallback: the next route by the option's
 * strategy among those that still fit (product rule pool, insurance, COD, same or faster
 * speed) / WHY: what the merchant pays the courier must match what the shopper was charged
 * for, and a failed route must never be swapped for another one silently.
 */
import {
  type OrderDeliveryRoute,
  type OrderShippingSnapshot,
  order,
  orderLine,
  type StoreTx,
  variant,
} from '@commerce/db'
import { eq } from 'drizzle-orm'
import type { CourierRateRow } from '../courier-rates'
import type { DeliveryOption, RouteSetting } from './config'
import { type ProviderAnswer, type Route, routeKey, routesFromAnswers } from './routes'
import { matchingRules, poolAllows, type RulePool, rulePool } from './rules'
import { activeDeliveryConfig, productFacts } from './service'

/** The route an order saved at checkout, if it was placed with the Delivery options app. */
export function orderDeliveryRoute(
  shipping: OrderShippingSnapshot | null | undefined,
): OrderDeliveryRoute | null {
  return shipping?.delivery ?? null
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
): Promise<BookingContext | null> {
  const config = await activeDeliveryConfig(tx, storeId)
  if (!config) return null
  const [o] = await tx.select({ shipping: order.shipping }).from(order).where(eq(order.id, orderId))
  const delivery = orderDeliveryRoute(o?.shipping)
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
