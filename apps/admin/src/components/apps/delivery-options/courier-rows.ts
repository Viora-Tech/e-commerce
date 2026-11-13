/** SOURCE OF TRUTH: the route list's rows
 * WHAT:  Groups the route catalogue two ways: Routes shows one row per courier and app
 *        (Delhivery direct: Surface and Express), the courier list one row per courier and
 *        speed across apps (Ekart Surface via Shiprocket and RapidShyp, the cheaper wins).
 * WHY:   Checkout's list keeps one card per courier and speed (`courierList` in resolve.ts),
 *        while route settings are saved per courier and app (`carrierSettingKey`).
 * WHERE: routes-page.tsx, courier-switches-card.tsx, options-page.tsx.
 */
import { carrierSettingKey, courierId, type DeliverySpeed } from '@commerce/core/delivery-options'
import type { CatalogueRoute } from './format'

/** One courier through one app: a Routes table row. */
export type RouteRow = {
  id: string
  /** The route setting the row's switches and dialog save under. */
  settingKey: string
  providerId: string
  providerLabel: string
  channel: 'direct' | 'aggregator'
  carrierKey: string
  carrier: string
  speeds: DeliverySpeed[]
  /** Any of its routes has a live price; else a cost card, else none. */
  price: 'live' | 'card' | 'none'
  cod: boolean
  insures: boolean
  insurancePercent: number | null
  insuranceMinPaise: number | null
  enabled: boolean
  showName: boolean
}

const SPEEDS: readonly DeliverySpeed[] = ['standard', 'express']

export function routeRows(routes: readonly CatalogueRoute[]): RouteRow[] {
  const rows = new Map<string, RouteRow>()
  for (const r of routes) {
    const id = `${r.providerId}|${r.carrierKey}`
    const price: RouteRow['price'] =
      r.costPaise !== null && !r.costFromCard ? 'live' : r.costFromCard ? 'card' : 'none'
    const had = rows.get(id)
    if (!had) {
      rows.set(id, {
        id,
        settingKey: carrierSettingKey(r.carrierKey, r.providerId),
        providerId: r.providerId,
        providerLabel: r.providerLabel,
        channel: r.channel,
        carrierKey: r.carrierKey,
        carrier: r.carrier,
        speeds: [r.speed],
        price,
        cod: r.codAvailable !== false,
        insures: r.insures,
        insurancePercent: r.insurancePercent,
        insuranceMinPaise: r.insuranceMinPaise,
        enabled: r.enabled,
        showName: r.showCarrier,
      })
      continue
    }
    if (!had.speeds.includes(r.speed)) {
      had.speeds = SPEEDS.filter((s) => s === r.speed || had.speeds.includes(s))
    }
    if (price === 'live' || (price === 'card' && had.price === 'none')) had.price = price
    had.cod ||= r.codAvailable !== false
    had.insures ||= r.insures
    had.enabled &&= r.enabled
    had.showName &&= r.showCarrier
  }
  return [...rows.values()]
}

/** One courier at one speed, from every app that offers it: a courier list row. */
export type CourierRow = {
  /** `courierId`: what `couriers.allow` holds. */
  id: string
  carrierKey: string
  carrier: string
  speed: DeliverySpeed
  direct: boolean
  /** The aggregators that offer it, by name. */
  via: string[]
}

export function courierRows(routes: readonly CatalogueRoute[]): CourierRow[] {
  const rows = new Map<string, CourierRow>()
  for (const r of routes) {
    if (!r.enabled) continue
    const id = courierId(r.carrierKey, r.speed)
    const row = rows.get(id) ?? {
      id,
      carrierKey: r.carrierKey,
      carrier: r.carrier,
      speed: r.speed,
      direct: false,
      via: [],
    }
    if (r.channel === 'direct') row.direct = true
    else if (!row.via.includes(r.providerLabel)) row.via.push(r.providerLabel)
    rows.set(id, row)
  }
  // Direct couriers first, then by name, Surface before Express.
  return [...rows.values()].sort(
    (a, b) =>
      Number(!a.direct) - Number(!b.direct) ||
      a.carrier.localeCompare(b.carrier) ||
      SPEEDS.indexOf(a.speed) - SPEEDS.indexOf(b.speed),
  )
}
