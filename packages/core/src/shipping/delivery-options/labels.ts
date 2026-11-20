/** SOURCE OF TRUTH: what a delivery card is called — WHAT: a route's speed word (Air, Express,
 * Surface) and its card label ("Delhivery Express", "Blue Dart Air", "Surface" when the courier
 * is hidden), and an option card's title ("Standard · Delhivery", or the route's own label
 * when the pick is of another speed) / WHY: a courier list showed "Delhivery" twice (one per
 * speed), and a Standard card read "Standard · Delhivery" over an Express route (#1781 item
 * 10). The engine, checkout and Try a PIN name cards the same way. Pure.
 */
import type { DeliverySpeed } from './config'

type Labelled = {
  carrier: string
  showCarrier: boolean
  serviceLabel: string
  speed: DeliverySpeed
}

/** Air when the service flies (Blue Dart Apex, "Bluedart Air"), else the speed. */
export function speedWord(route: Pick<Labelled, 'serviceLabel' | 'speed'>): string {
  if (/\bair\b|apex/i.test(route.serviceLabel)) return 'Air'
  return route.speed === 'express' ? 'Express' : 'Surface'
}

/** "Delhivery Express", "Delhivery Surface", "Blue Dart Air"; just the speed when hidden. */
export function routeCardLabel(route: Labelled): string {
  const word = speedWord(route)
  if (!route.showCarrier) return word
  // "Ecom Express" at Express speed stays "Ecom Express", not "Ecom Express Express".
  return new RegExp(`\\b${word}\\b`, 'i').test(route.carrier)
    ? route.carrier
    : `${route.carrier} ${word}`
}

/**
 * The option card's title. A courier list's cards and a pick of another speed than the option
 * (a list option, or a rule forcing Air on Standard) are named by the route itself, so a
 * "Standard" title never sits over an Express route; otherwise "Standard · Delhivery".
 */
export function optionCardTitle(
  option: { name: string; speed: DeliverySpeed },
  route: Labelled | null,
  list: boolean,
): string {
  if (!route) return option.name
  if (list || route.speed !== option.speed) return routeCardLabel(route)
  return route.showCarrier ? `${option.name} · ${route.carrier}` : option.name
}
