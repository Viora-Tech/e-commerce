import 'server-only'
import {
  type DeliveryResolveResult,
  type ResolvedOption,
  routeCardLabel,
  type toShippingPolicy,
} from '@commerce/core'
import { formatDeliveryRange } from '@commerce/shipping'
import { deliveryOptionsContent } from '@/data/delivery-options'
import { arrivalLabel } from './rate-dates'

/*
 * What the Delivery options app's checkout cards show beyond a plain rate: the courier's logo
 * and label, the date lines, the sub-choices and each parcel's own dates. Split from
 * `delivery-options.ts` (quotes and the snapshot), which re-exports these.
 */

/** One sub-choice under an option card ("Blue Dart Air"). */
export type DeliveryChoiceCard = {
  routeKey: string
  label: string
  pricePaise: number
  arrives: string | null
  /** The courier's logo when its name is shown (list cards). */
  logo: CourierLogo | null
  /** How the route travels, for the card's fact line ("By air"). */
  mode: DeliveryMode
  /** First day it can arrive, "YYYY-MM-DD"; null when unknown. Picks the fastest list card. */
  earliest: string | null
  /** A courier list card's price on cash on delivery; null: no COD on this courier. */
  codPricePaise?: number | null | undefined
  /** The courier's COD charge shown as its own line on this card; null: none. */
  codFeePaise?: number | null | undefined
}

/** How a route travels, read from its service: Blue Dart Apex and "Air" services fly. */
export type DeliveryMode = 'air' | 'express' | 'surface'

export function deliveryMode(route: { serviceLabel: string; speed: string }): DeliveryMode {
  if (/\bair\b|apex/i.test(route.serviceLabel)) return 'air'
  return route.speed === 'express' ? 'express' : 'surface'
}

/** What checkout needs beyond a plain rate card, per delivery option. */
export type DeliveryCardExtras = {
  /** The option refuses cash on delivery (Express). */
  codAllowed: boolean
  /** Shipping when the shopper pays on delivery (Standard's COD route); null: same price. */
  codPricePaise: number | null
  /** The carrier COD ships with, for the Payment step's note. */
  codCarrier: string | null
  /** Before free-above, struck through when the card is free. */
  listPricePaise: number
  choices: DeliveryChoiceCard[]
  /** The option's own name ("Express"), for "Not available with Express delivery". */
  optionName: string
  /** The picked courier's logo, when the merchant shows its name; null otherwise. */
  logo: CourierLogo | null
  /** `list`: each choice is its own card (the option's Couriers setting). */
  layout: 'one' | 'list'
  /** The first card is a product rule's preferred courier, not just the cheapest. */
  preferred?: boolean | undefined
  /** How the picked route travels; null on backup (no route). */
  mode: DeliveryMode | null
  /**
   * This card's "Insure this parcel" tick: shown when `offered`; `on` is what the card's price
   * assumes (and what Pay sends); `extraPaise` is what ticking adds ("+₹20").
   */
  insurance?: { offered: boolean; on: boolean; extraPaise: number | null } | undefined
}

export type CourierLogo = {
  /** A file in `public/courier-logos/`; null: no file for this courier, the card shows
   *  `initials` on a tile instead (as the admin's courier drawer does). */
  src: string | null
  alt: string
  /** Dark lettering: sits on a white tile. */
  light: boolean
  /** "AS" for Amazon Shipping: the tile when there is no file. */
  initials: string
}

/**
 * Logos shipped in `public/courier-logos/`, by the carrier key `normaliseCarrier` gives (the
 * same files as the admin's `public/app-logos`). A courier with no file (Amazon Shipping, Ecom
 * Express, Gati, Smartr) gets an initials tile; drop its file here and add a line to show it.
 * The proxy must skip `courier-logos/` (`src/proxy.ts` matcher) or every file 404s.
 */
const COURIER_LOGOS: Record<string, { file: string; light?: boolean }> = {
  delhivery: { file: 'delhivery.png' },
  bluedart: { file: 'bluedart.svg', light: true },
  dtdc: { file: 'dtdc.png' },
  xpressbees: { file: 'xpressbees.png' },
  ekart: { file: 'ekart.png' },
  shadowfax: { file: 'shadowfax.png' },
  'india-post': { file: 'india-post.png' },
  dhl: { file: 'dhl.svg', light: true },
  fedex: { file: 'fedex.svg', light: true },
}

/** "Amazon Shipping" → "AS", "DTDC" → "DT". */
export function courierInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const letters =
    words.length > 1 ? words.map((w) => w[0] ?? '').join('') : (words[0] ?? '').slice(0, 2)
  return letters.slice(0, 2).toUpperCase() || '?'
}

export function courierLogo(route: {
  carrierKey: string
  carrier: string
  showCarrier: boolean
}): CourierLogo | null {
  // A courier the merchant hides keeps the plain truck: no name, no logo.
  if (!route.showCarrier) return null
  const logo = COURIER_LOGOS[route.carrierKey]
  return {
    src: logo ? `/courier-logos/${logo.file}` : null,
    alt: route.carrier,
    light: logo?.light === true,
    initials: courierInitials(route.carrier),
  }
}

/** One parcel's window for one card, by the parcel's `locationId:status` key. */
export type ParcelDates = {
  key: string
  earliest: string | null
  latest: string | null
  /** "Sun, 22 Nov", as the parcel list shows it; null when unknown. */
  dateRange: string | null
}

/** By `${optionId}|${routeKey}` (`|` alone: the option's own pick). */
export type ParcelDatesByCard = Record<string, ParcelDates[]>

/**
 * Every parcel's own dates for every card, from the same engine run that added the card up
 * (the card's date is the last parcel's), so the parcels under the cards never show a date
 * of their own (#1781 item 11: card Sun 22 Nov, Parcel 1 Tue 24 Nov).
 */
export function parcelDatesByCard(
  result: DeliveryResolveResult,
  keys: readonly string[] | null,
): ParcelDatesByCard {
  const out: ParcelDatesByCard = {}
  const parts = result.parcels
  if (!parts || !keys || parts.length !== keys.length) return out
  type Dates = { earliest: string | null; latest: string | null }
  const add = (card: string, key: string, d: Dates) => {
    const list = out[card] ?? []
    list.push({ key, earliest: d.earliest, latest: d.latest, dateRange: deliveryDateRange(d) })
    out[card] = list
  }
  parts.forEach((part, i) => {
    const key = keys[i] ?? ''
    for (const o of part.options) {
      add(`${o.optionId}|`, key, o.pick ?? o)
      for (const c of o.choices) add(`${o.optionId}|${c.route.key}`, key, c)
    }
  })
  return out
}

/** The date line under a card or sub-choice. */
export function deliveryArrives(
  dates: { earliest: string | null; latest: string | null; etaEstimated: boolean },
  policy: ReturnType<typeof toShippingPolicy>,
  now: Date,
): string | null {
  if (dates.etaEstimated) {
    return deliveryOptionsContent.usually(
      policy.defaultMinTransitDays,
      policy.defaultMaxTransitDays,
    )
  }
  if (!dates.earliest || !dates.latest) return null
  return arrivalLabel(
    { earliest: dates.earliest, latest: dates.latest, source: 'courier' },
    now,
    policy.timeZone,
  )
}

export function deliveryDateRange(o: {
  earliest: string | null
  latest: string | null
}): string | null {
  return o.earliest && o.latest ? formatDeliveryRange(o.earliest, o.latest) : null
}

/**
 * The courier's COD charge when the option shows it as its own line (`cod.fee: 'separate'`):
 * the first list card's, else the COD pick's; null: none, the store's COD fee stays. It is a
 * payment fee, so no shipping discount applies to it. `placeOrder` charges the same
 * (`orderDeliveryFor`).
 */
export function optionCodFee(o: ResolvedOption): number | null {
  if (!o.codAllowed) return null
  if (o.layout === 'list' && o.choices[0]) return o.choices[0].codFeePaise ?? null
  return o.cod?.codFeePaise ?? null
}

export function cardExtras(
  o: ResolvedOption,
  policy: ReturnType<typeof toShippingPolicy>,
  now: Date,
  afterDiscount: (paise: number) => number,
): DeliveryCardExtras {
  return {
    codAllowed: o.codAllowed,
    // A courier list keeps the first card's courier on COD (its own COD price, no other carrier).
    ...(o.layout === 'list' && o.choices[0]?.codPricePaise != null
      ? { codPricePaise: afterDiscount(o.choices[0].codPricePaise), codCarrier: null }
      : {
          codPricePaise: o.cod ? afterDiscount(o.cod.pricePaise) : null,
          codCarrier: o.cod?.route.showCarrier ? o.cod.route.carrier : null,
        }),
    listPricePaise: o.listPricePaise,
    optionName: o.name,
    logo: o.pick ? courierLogo(o.pick.route) : null,
    layout: o.layout,
    preferred: o.pickedBy.startsWith('rule:'),
    mode: o.pick ? deliveryMode(o.pick.route) : null,
    insurance: {
      offered: o.insurance.offered,
      on: o.insurance.on,
      extraPaise: o.insurance.extraPaise ?? null,
    },
    choices: o.choices.map((c) => ({
      routeKey: c.route.key,
      // "Delhivery Express", "Delhivery Surface": never the same courier name twice.
      label: routeCardLabel(c.route),
      pricePaise: afterDiscount(c.pricePaise),
      arrives: deliveryArrives(c, policy, now),
      logo: courierLogo(c.route),
      mode: deliveryMode(c.route),
      earliest: c.etaEstimated ? null : c.earliest,
      codPricePaise: c.codPricePaise != null ? afterDiscount(c.codPricePaise) : null,
      codFeePaise: c.codFeePaise ?? null,
    })),
  }
}
