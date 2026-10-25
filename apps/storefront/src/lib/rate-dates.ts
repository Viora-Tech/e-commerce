import 'server-only'

import {
  addCalendarDays,
  computeDeliveryEstimate,
  type DeliveryEstimate,
  formatDeliveryRange,
  formatShortDate,
  type ShippingPolicy,
  zonedNow,
} from '@commerce/shipping'
import { checkoutContent } from '@/data/checkout'

/*
 * When each shipping option arrives, as the checkout's option cards say it. Pure apart from
 * the clock it is handed, so it is tested on its own. `placeOrder` stores the parcel windows
 * from `checkoutParcels`; this is only what the shopper reads before choosing.
 */

/** Where a window came from: the courier's answer, the rate's own days, or the store's defaults. */
export type WindowSource = 'courier' | 'rate' | 'policy'

export type RateWindow = { earliest: string; latest: string; source: WindowSource }

export type RateDays = { minTransitDays: number | null; maxTransitDays: number | null }

const copy = checkoutContent.delivery

/**
 * The delivery window for one option. The courier's real answer for this PIN code comes first
 * (it describes its standard service, so it dates the store's standard, cheapest option and any
 * option without days of its own); an option with its own transit days (Express, 1-2 days) keeps
 * its promise; with no courier answer the option's days, then the store's default days, count.
 */
export function rateWindow(input: {
  rate: RateDays
  /** The cheapest option: the courier's standard service. */
  standard: boolean
  delivery: DeliveryEstimate
  policy: ShippingPolicy
  now: Date
}): RateWindow | null {
  const { rate, delivery } = input
  if (!delivery.ok || !delivery.serviceable) return null
  const fromDelivery = (source: WindowSource): RateWindow => ({
    earliest: delivery.earliestDate,
    latest: delivery.latestDate,
    source,
  })
  const ownDays = rate.minTransitDays !== null && rate.maxTransitDays !== null
  if (!delivery.fallback && (input.standard || !ownDays)) return fromDelivery('courier')
  if (ownDays) {
    try {
      const e = computeDeliveryEstimate({
        now: input.now,
        minTransitDays: rate.minTransitDays as number,
        maxTransitDays: rate.maxTransitDays as number,
        policy: input.policy,
      })
      return { earliest: e.earliestDate, latest: e.latestDate, source: 'rate' }
    } catch {
      // A calendar with no working days left: the courier's (or default) window still stands.
    }
  }
  return fromDelivery(delivery.fallback ? 'policy' : 'courier')
}

/**
 * "Arrives tomorrow, Sat 11 Oct", "Arrives Tue, 14 Oct", or "Arrives Tue, 14 Oct - Thu, 16 Oct",
 * counted from today in the store's time zone.
 */
export function arrivalLabel(window: RateWindow, now: Date, timeZone: string): string {
  const today = zonedNow(now, timeZone).date
  if (window.earliest !== window.latest) {
    return copy.arrives(formatDeliveryRange(window.earliest, window.latest))
  }
  if (window.earliest === today) return copy.arrivesToday
  const date = formatShortDate(window.earliest)
  return window.earliest === addCalendarDays(today, 1)
    ? copy.arrivesTomorrow(date)
    : copy.arrives(date)
}

/** The option whose window ends first, when the options do not all arrive together. */
export function fastestRate<T extends { window: RateWindow | null }>(rates: T[]): T | null {
  const dated = rates.filter((r) => r.window !== null)
  if (dated.length < 2) return null
  const by = (r: T) => `${r.window?.latest}|${r.window?.earliest}`
  const sorted = [...dated].sort((a, b) => by(a).localeCompare(by(b)))
  const [first, second] = sorted
  return first && second && by(first) !== by(second) ? first : null
}
