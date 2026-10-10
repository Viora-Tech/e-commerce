import 'server-only'
import { loadEnv } from '@commerce/config'
import {
  type DeliveryEstimate,
  freeShippingThreshold,
  loadRateZones,
  parseShippingSettings,
  previewCartParcels,
  primaryShippingProvider,
  quoteCartShipping,
  type Serviceability,
  type ShippingRateOption,
  type ShippingSettings,
  toShippingPolicy,
} from '@commerce/core'
import { registriesForStore } from '@commerce/core/registries'
import type { StoreTx } from '@commerce/db'
import { store } from '@commerce/db'
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
import { itemTitle, parcelFrom, type ShopperParcel } from './parcels'

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
  const provider = primaryShippingProvider(shipping, settings, secret)
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
      console.warn(`[shipping] ${provider.id} lookup failed: ${describeCourierFailure(err)}`)
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
 * everywhere (null when there is no such promise).
 */
export async function cartShippingHint(
  tx: StoreTx,
): Promise<{ charged: boolean; freeAbovePaise: number | null }> {
  const zones = await loadRateZones(tx)
  return { charged: zones.length > 0, freeAbovePaise: freeShippingThreshold(zones) }
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
}

/** A rate's own delivery promise, or the courier's when the rate sets none. */
function rateRange(
  option: ShippingRateOption,
  settings: ShippingSettings,
  delivery: DeliveryEstimate,
): string | null {
  const fallback = delivery.ok && delivery.serviceable ? delivery.dateRange : null
  if (option.minTransitDays === null || option.maxTransitDays === null) return fallback
  try {
    const e = computeDeliveryEstimate({
      now: new Date(),
      minTransitDays: option.minTransitDays,
      maxTransitDays: option.maxTransitDays,
      policy: toShippingPolicy(settings),
    })
    return formatDeliveryRange(e.earliestDate, e.latestDate)
  } catch {
    return fallback
  }
}

/**
 * The courier's answer for the PIN code plus the store's rates for this cart
 * and address, priced the way `placeOrder` will price them.
 */
export async function checkoutShipping(
  tx: StoreTx,
  storeId: string,
  cartId: string,
  to: { pincode: string; stateCode: string },
): Promise<CheckoutShipping> {
  const delivery = await estimateForPincode(tx, storeId, to.pincode)
  if (!delivery.ok || !delivery.serviceable) {
    return { delivery, rates: { kind: 'none' }, parcels: [] }
  }
  const split = await checkoutParcels(tx, storeId, cartId, to)
  const parcels = split.length > 1 ? split : []
  const quote = await quoteCartShipping({ storeId, tx }, cartId, to)
  if (quote.kind === 'not_configured') return { delivery, rates: { kind: 'free' }, parcels }
  if (quote.kind === 'no_rates') return { delivery, rates: { kind: 'none' }, parcels }
  const settings = await loadShippingSettings(tx, storeId)
  return {
    delivery,
    parcels,
    rates: {
      kind: 'rates',
      options: quote.options.map((o) => ({
        id: o.rateId,
        name: o.name,
        pricePaise: o.pricePaise,
        dateRange: rateRange(o, settings, delivery),
        codSurchargePaise: o.codSurchargePaise,
      })),
    },
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
