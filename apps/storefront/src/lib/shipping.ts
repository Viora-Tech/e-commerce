import 'server-only'
import { loadEnv } from '@commerce/config'
import {
  cartShippingHintFor,
  type DeliveryEstimate,
  domesticShippingProvider,
  getCart,
  parseShippingSettings,
  previewCartParcels,
  quoteCartShipping,
  type Serviceability,
  type ShippingRateOption,
  type ShippingSettings,
  toShippingPolicy,
} from '@commerce/core'
import { isAbroad } from '@commerce/core/checkout-address'
import { registriesForStore } from '@commerce/core/registries'
import type { StoreTx } from '@commerce/db'
import { store } from '@commerce/db'
import { logger } from '@commerce/observability/logging'
import {
  cacheGet,
  cacheSet,
  SERVICEABILITY_TTL_SECONDS,
  serviceabilityKey,
  sharedRedis,
} from '@commerce/queue'
import {
  computeDeliveryEstimate,
  describeCourierFailure,
  estimateDelivery,
  formatDeliveryRange,
  parsePincode,
} from '@commerce/shipping'
import { eq } from 'drizzle-orm'
import {
  type CheckoutDelivery,
  cardExtras,
  checkoutDelivery,
  type DeliveryCardExtras,
  deliveryDateRange,
  deliveryArrives as optionArrives,
} from './delivery-options'
import { itemTitle, parcelFrom, type ShopperParcel } from './parcels'
import { arrivalLabel, fastestRate, type RateWindow, rateWindow } from './rate-dates'

const env = () => loadEnv(process.env)

export async function loadShippingSettings(
  tx: StoreTx,
  storeId: string,
): Promise<ShippingSettings> {
  const [s] = await tx.select({ shipping: store.shipping }).from(store).where(eq(store.id, storeId))
  return parseShippingSettings(s?.shipping)
}

/**
 * Delivery estimate for a pincode, with the courier's serviceability answer
 * cached per store for a day. The date maths always runs fresh - it depends
 * on the clock; the cache only remembers what the courier said. `originPincode`
 * is where the parcel leaves from (a warehouse's PIN code); omitted, the store's.
 */
export async function estimateForPincode(
  tx: StoreTx,
  storeId: string,
  pincode: string,
  originPincode?: string | null,
): Promise<DeliveryEstimate> {
  const settings = await loadShippingSettings(tx, storeId)
  const secret = env().SETTINGS_SECRET
  const { shipping } = await registriesForStore(tx, storeId)
  const provider = domesticShippingProvider(shipping, settings, secret)
  const parsed = parsePincode(pincode)
  const storePolicy = toShippingPolicy(settings)
  const origin = originPincode ? parsePincode(originPincode) : null
  const policy = origin?.ok ? { ...storePolicy, originPincode: origin.pincode } : storePolicy
  if (!provider || !parsed.ok) {
    return estimateDelivery({ pincode, policy, provider, now: new Date() })
  }

  const redis = sharedRedis(env().REDIS_URL)
  // Each origin has its own answer; the store's own origin keeps the key it always had.
  const key = serviceabilityKey(
    storeId,
    provider.id,
    policy.originPincode === storePolicy.originPincode
      ? parsed.pincode
      : `${policy.originPincode}>${parsed.pincode}`,
  )
  let answer = await cacheGet<Serviceability>(redis, key)
  let reachable = true
  if (!answer) {
    try {
      answer = await provider.checkServiceability({
        originPincode: policy.originPincode,
        destinationPincode: parsed.pincode,
      })
      await cacheSet(redis, key, answer, SERVICEABILITY_TTL_SECONDS)
    } catch (err) {
      // Passing no provider below marks the estimate as a fallback without a second call.
      reachable = false
      logger.warn('courier serviceability lookup failed', {
        storeId,
        provider: provider.id,
        reason: describeCourierFailure(err),
      })
    }
  }
  return estimateDelivery({
    pincode: parsed.pincode,
    policy,
    provider: reachable ? provider : null,
    now: new Date(),
    cached: answer,
  })
}

/**
 * What the cart can say about shipping before there is an address: whether
 * the store charges for it at all, and the order value from which it is free
 * everywhere for the cart's products, by their shipping profiles (null when
 * there is no such promise).
 */
export async function cartShippingHint(
  tx: StoreTx,
  cartId: string | null,
): Promise<{ charged: boolean; freeAbovePaise: number | null }> {
  return cartShippingHintFor(tx, cartId)
}

/** One shipping choice as the checkout shows it. */
export type CheckoutRate = {
  id: string
  name: string
  pricePaise: number
  /** "Tue, 18 Aug - Thu, 20 Aug", from the rate's own days or the courier's estimate. */
  dateRange: string | null
  /** Replaces the store's COD fee when the shopper pays on delivery; null keeps the store's. */
  codSurchargePaise: number | null
  /** "Arrives tomorrow, Sat 11 Oct": the option card's date line (`lib/rate-dates.ts`). */
  arrives: string | null
  /** The option that arrives first, when the options do not all arrive together. */
  fastest: boolean
  /** Delivery options app: COD, the sub-choices and the struck-through price of this card. */
  delivery?: DeliveryCardExtras | undefined
  /** Local delivery or pickup in store: the location's pickup time and instructions. */
  instructions?: string | null | undefined
}

export type CheckoutShipping = {
  delivery: DeliveryEstimate
  /**
   * `free`: the store has no rates (shipping is free). `none`: nothing covers
   * this address. `rates`: the options, cheapest first.
   */
  rates: { kind: 'free' } | { kind: 'none' } | { kind: 'rates'; options: CheckoutRate[] }
  /** "Ships in 2 parcels": filled only when the order would split across warehouses. */
  parcels: ShopperParcel[]
  /** The courier's (or the store's default) arrival for this PIN code, for free shipping. */
  arrives: string | null
  /** Delivery options app: the quote Pay prices from, and the insurance checkbox. */
  deliveryQuote?: Pick<CheckoutDelivery, 'quoteId' | 'insurance'> | undefined
  /** Nothing in the cart needs shipping (services, downloads): no charge, no courier asked. */
  nothingShips?: true | undefined
}

/** Stands in for the courier's answer when nothing in the cart travels. */
const NOTHING_SHIPS: Extract<DeliveryEstimate, { serviceable: true }> = {
  ok: true,
  serviceable: true,
  pincode: '',
  // Cash is collected by the courier on delivery; with no parcel there is no one to collect it.
  codAvailable: false,
  dateRange: '',
  earliestDate: '',
  latestDate: '',
  dispatchDate: '',
  dispatchLabel: '',
  dispatchesToday: false,
  fallback: true,
  provider: 'none',
}

/** Whether a cart has nothing to ship: every line a gift card or a variant without shipping. */
async function cartNothingShips(tx: StoreTx, storeId: string, cartId: string): Promise<boolean> {
  const cart = await getCart({ storeId, tx }, cartId)
  return (
    !!cart?.lines.length &&
    cart.lines.every((l) => l.giftCard || !l.requiresShipping) &&
    !cart.lines.every((l) => l.giftCard)
  )
}

/** The options as cards: each with its window (`rateWindow`), its date line and the fastest flag. */
function datedRates(
  options: ShippingRateOption[],
  settings: ShippingSettings,
  delivery: DeliveryEstimate,
  now: Date,
): CheckoutRate[] {
  const policy = toShippingPolicy(settings)
  // Pickup (free) and local delivery are not the courier's standard service.
  const shipped = options.filter((o) => !o.local)
  const cheapest = Math.min(...shipped.map((o) => o.pricePaise))
  const dated = options.map((o, i) => ({
    o,
    // Local delivery and pickup run on the store's own clock, not a courier's.
    window: o.local
      ? null
      : rateWindow({
          rate: o,
          // The first of the cheapest options is the courier's standard service.
          standard:
            o.pricePaise === cheapest && shipped.findIndex((x) => x.pricePaise === cheapest) === i,
          delivery,
          policy,
          now,
        }),
  }))
  const fastest = fastestRate(dated)
  return dated.map(({ o, window }) => ({
    id: o.rateId,
    name: o.name,
    pricePaise: o.pricePaise,
    dateRange: window ? formatDeliveryRange(window.earliest, window.latest) : null,
    codSurchargePaise: o.codSurchargePaise,
    arrives: window ? arrivalLabel(window, now, policy.timeZone) : null,
    fastest: fastest?.o === o,
    instructions: o.local?.instructions || null,
  }))
}

/** The delivery estimate's own arrival line (free shipping has no options to date). */
function deliveryArrives(delivery: DeliveryEstimate, settings: ShippingSettings, now: Date) {
  if (!delivery.ok || !delivery.serviceable) return null
  const window: RateWindow = {
    earliest: delivery.earliestDate,
    latest: delivery.latestDate,
    source: delivery.fallback ? 'policy' : 'courier',
  }
  return arrivalLabel(window, now, toShippingPolicy(settings).timeZone)
}

/**
 * The courier's answer for the PIN code plus the store's rates for this cart
 * and address, priced the way `placeOrder` will price them.
 */
export async function checkoutShipping(
  tx: StoreTx,
  storeId: string,
  cartId: string,
  to: { pincode: string; stateCode: string; countryCode?: string | undefined },
  opts: { declineInsurance?: boolean | undefined; quoteId?: string | null | undefined } = {},
): Promise<CheckoutShipping> {
  // A service or a download: the address is kept for the invoice, but nothing is quoted.
  if (await cartNothingShips(tx, storeId, cartId)) {
    return {
      delivery: { ...NOTHING_SHIPS, pincode: to.pincode },
      rates: { kind: 'free' },
      parcels: [],
      arrives: null,
      nothingShips: true,
    }
  }
  if (isAbroad(to.countryCode)) return abroadShipping(tx, storeId, cartId, to)
  const fromApp = await deliveryOptionsShipping(tx, storeId, cartId, to, opts)
  if (fromApp) return fromApp
  const delivery = await estimateForPincode(tx, storeId, to.pincode)
  if (!delivery.ok || !delivery.serviceable) {
    return { delivery, rates: { kind: 'none' }, parcels: [], arrives: null }
  }
  const split = await checkoutParcels(tx, storeId, cartId, to)
  const parcels = split.length > 1 ? split : []
  const quote = await quoteCartShipping({ storeId, tx }, cartId, to)
  const settings = await loadShippingSettings(tx, storeId)
  const now = new Date()
  const arrives = deliveryArrives(delivery, settings, now)
  if (quote.kind === 'not_configured')
    return { delivery, rates: { kind: 'free' }, parcels, arrives }
  if (quote.kind === 'no_rates') return { delivery, rates: { kind: 'none' }, parcels, arrives }
  return {
    delivery,
    parcels,
    arrives,
    rates: { kind: 'rates', options: datedRates(quote.options, settings, delivery, now) },
  }
}

/**
 * An address abroad: the country zones' rates for the cart (`placeOrder` prices the same), with
 * no Indian courier asked and no cash on delivery. A rate with its own transit days shows its
 * dates; others show none, as the store's Indian dispatch days do not say when a parcel abroad
 * lands. `delivery` stands in as "serviceable, prepaid only" for the rest of the checkout.
 */
async function abroadShipping(
  tx: StoreTx,
  storeId: string,
  cartId: string,
  to: { pincode: string; stateCode: string; countryCode?: string | undefined },
): Promise<CheckoutShipping> {
  const delivery: DeliveryEstimate = {
    ok: true,
    serviceable: true,
    pincode: to.pincode,
    codAvailable: false,
    dateRange: '',
    earliestDate: '',
    latestDate: '',
    dispatchDate: '',
    dispatchLabel: '',
    dispatchesToday: false,
    fallback: true,
    provider: 'abroad',
  }
  const quote = await quoteCartShipping({ storeId, tx }, cartId, {
    pincode: to.pincode,
    stateCode: to.stateCode,
    countryCode: to.countryCode,
  })
  if (quote.kind === 'not_configured') {
    return { delivery, rates: { kind: 'free' }, parcels: [], arrives: null }
  }
  if (quote.kind === 'no_rates') {
    return { delivery, rates: { kind: 'none' }, parcels: [], arrives: null }
  }
  const policy = toShippingPolicy(await loadShippingSettings(tx, storeId))
  const now = new Date()
  const windowOf = (o: ShippingRateOption): RateWindow | null => {
    if (o.minTransitDays === null || o.maxTransitDays === null) return null
    try {
      const e = computeDeliveryEstimate({
        now,
        minTransitDays: o.minTransitDays,
        maxTransitDays: o.maxTransitDays,
        policy,
      })
      return { earliest: e.earliestDate, latest: e.latestDate, source: 'rate' }
    } catch {
      return null
    }
  }
  const options: CheckoutRate[] = quote.options.map((o) => {
    const window = windowOf(o)
    return {
      id: o.rateId,
      name: o.name,
      pricePaise: o.pricePaise,
      dateRange: window ? formatDeliveryRange(window.earliest, window.latest) : null,
      codSurchargePaise: null,
      arrives: window ? arrivalLabel(window, now, policy.timeZone) : null,
      fastest: false,
    }
  })
  return { delivery, rates: { kind: 'rates', options }, parcels: [], arrives: null }
}

/**
 * The Delivery options app's cards (courier, dates, price per option), or null when the app is
 * off or had nothing to show (couriers down with no zone rate: the zone rates path decides).
 */
async function deliveryOptionsShipping(
  tx: StoreTx,
  storeId: string,
  cartId: string,
  to: { pincode: string; stateCode: string },
  opts: { declineInsurance?: boolean | undefined; quoteId?: string | null | undefined },
): Promise<CheckoutShipping | null> {
  const app = await checkoutDelivery(tx, storeId, cartId, to, opts)
  if (!app || app.delivery.status === 'none') return null
  const settings = await loadShippingSettings(tx, storeId)
  const policy = toShippingPolicy(settings)
  const now = new Date()
  const { delivery: quote, zone } = app
  const options = quote.options
  /* The courier summary the rest of checkout reads (serviceable, COD at all): from the routes,
     not from one courier. */
  const delivery = await estimateDelivery({
    pincode: to.pincode,
    policy,
    provider: null,
    now,
    cached: {
      provider: 'delivery-options',
      serviceable: quote.status === 'options',
      codAvailable: options.some((o) => o.codAllowed),
      prepaidAvailable: true,
      minTransitDays: null,
      maxTransitDays: null,
      reason: null,
    },
  })
  if (quote.status === 'unserviceable')
    return { delivery, rates: { kind: 'none' }, parcels: [], arrives: null }
  const split = await checkoutParcels(tx, storeId, cartId, to)
  const afterDiscount = zone.afterDiscount ?? ((p: number) => p)
  const latest = options.map((o) => o.latest ?? '9999')
  const first = [...latest].sort()[0]
  const fastestAlone = latest.filter((l) => l === first).length === 1 && options.length > 1
  const rates: CheckoutRate[] = options.map((o, i) => ({
    id: o.optionId,
    name: o.title,
    pricePaise: afterDiscount(o.pricePaise),
    dateRange: deliveryDateRange(o),
    codSurchargePaise: null,
    arrives: optionArrives(o, policy, now),
    fastest: fastestAlone && latest[i] === first,
    delivery: cardExtras(o, policy, now, afterDiscount),
  }))
  return {
    delivery,
    rates: { kind: 'rates', options: rates },
    parcels: split.length > 1 ? split : [],
    arrives: rates[0]?.arrives ?? null,
    deliveryQuote: { quoteId: quote.quoteId, insurance: quote.insurance },
  }
}

/**
 * Where the cart would ship from to this address, one entry per parcel, each with the courier's
 * estimate from its own location. Empty when it cannot be worked out (placing the order then
 * refuses with its own message).
 */
export async function checkoutParcels(
  tx: StoreTx,
  storeId: string,
  cartId: string,
  to: { pincode: string; stateCode: string },
): Promise<ShopperParcel[]> {
  const previews = await previewCartParcels({ storeId, tx }, cartId, to.stateCode)
  const out: ShopperParcel[] = []
  for (const p of previews) {
    const e = await estimateForPincode(tx, storeId, to.pincode, p.pincode)
    const ok = e.ok && e.serviceable
    out.push({
      key: `${p.locationId}:${p.status}`,
      from: parcelFrom(p),
      items: p.lines.map((l) => ({
        title: itemTitle(l.title, l.variantTitle),
        quantity: l.quantity,
      })),
      dateRange: ok ? e.dateRange : null,
      onHold: p.status === 'on_hold',
      locationId: p.locationId,
      estimate: ok ? { earliest: e.earliestDate, latest: e.latestDate } : null,
    })
  }
  return out
}
