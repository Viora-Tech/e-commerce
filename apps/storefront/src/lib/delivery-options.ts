import 'server-only'
import { loadEnv } from '@commerce/config'
import {
  activeDeliveryConfig,
  cartItemFacts,
  cartKeyOf,
  cartLineKeys,
  DELIVERY_SNAPSHOT_TTL_SECONDS,
  type DeliveryChoice,
  type DeliveryQuoteSnapshot,
  type DeliveryResolveResult,
  deliverySnapshotKey,
  gatherProviderAnswers,
  type ProviderAnswer,
  type QuoteCache,
  quoteCartShipping,
  quoteDelivery,
  type ResolvedOption,
  resolveDeliveryOptions,
  resolveShippingProviders,
  shownPrices,
  toShippingPolicy,
} from '@commerce/core'
import { registriesForStore } from '@commerce/core/registries'
import type { StoreTx } from '@commerce/db'
import { cacheGet, cacheSet, sharedRedis } from '@commerce/queue'
import { formatDeliveryRange } from '@commerce/shipping'
import { deliveryOptionsContent } from '@/data/delivery-options'
import { arrivalLabel } from './rate-dates'
import { loadShippingSettings } from './shipping'

/*
 * The Delivery options app at checkout: the cards come from the store's connected couriers
 * (`@commerce/core` delivery-options engine) instead of only the hand-typed zone rates. The
 * computed options are kept for 30 minutes under a quote id, and Pay prices the order from
 * that snapshot, never by calling couriers again.
 */

const env = () => loadEnv(process.env)

function redisCache(): QuoteCache {
  const redis = sharedRedis(env().REDIS_URL)
  return {
    get: (key) => cacheGet(redis, key),
    set: (key, value, ttl) => cacheSet(redis, key, value, ttl),
  }
}

/** One sub-choice under an option card ("Blue Dart Air"). */
export type DeliveryChoiceCard = {
  routeKey: string
  label: string
  pricePaise: number
  arrives: string | null
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
}

export type CheckoutDelivery = {
  quoteId: string
  status: DeliveryResolveResult['status']
  options: ResolvedOption[]
  /** The checkbox under the cards: offered and ticked, with what it adds. */
  insurance: { offered: boolean; on: boolean; pricePaise: number | null }
}

/** "Delhivery", "Blue Dart Air": the carrier, with Air when the service flies. */
const choiceLabel = (carrier: string, serviceLabel: string): string =>
  /\bair\b/i.test(serviceLabel) && !/\bair\b/i.test(carrier) ? `${carrier} Air` : carrier

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

export function cardExtras(
  o: ResolvedOption,
  policy: ReturnType<typeof toShippingPolicy>,
  now: Date,
  afterDiscount: (paise: number) => number,
): DeliveryCardExtras {
  return {
    codAllowed: o.codAllowed,
    codPricePaise: o.cod ? afterDiscount(o.cod.pricePaise) : null,
    codCarrier: o.cod?.route.carrier ?? null,
    listPricePaise: o.listPricePaise,
    optionName: o.name,
    choices: o.choices.map((c) => ({
      routeKey: c.route.key,
      label: choiceLabel(c.route.carrier, c.route.serviceLabel),
      pricePaise: afterDiscount(c.pricePaise),
      arrives: deliveryArrives(c, policy, now),
    })),
  }
}

async function readSnapshot(
  storeId: string,
  quoteId: string,
): Promise<DeliveryQuoteSnapshot | null> {
  return cacheGet<DeliveryQuoteSnapshot>(
    sharedRedis(env().REDIS_URL),
    deliverySnapshotKey(storeId, quoteId),
  )
}

/**
 * The delivery options for this cart and address, or null when the app is off (zone rates as
 * before). A repeat ask for the same cart and PIN code (the insurance tick) reuses the
 * snapshot's courier answers rather than asking again, and adds the prices it now shows.
 */
export async function checkoutDelivery(
  tx: StoreTx,
  storeId: string,
  cartId: string,
  to: { pincode: string; stateCode: string },
  opts: { declineInsurance?: boolean | undefined; quoteId?: string | null | undefined } = {},
): Promise<{
  delivery: CheckoutDelivery
  zone: Awaited<ReturnType<typeof quoteCartShipping>>
} | null> {
  const config = await activeDeliveryConfig(tx, storeId)
  if (!config) return null
  const zone = await quoteCartShipping({ storeId, tx }, cartId, to)
  if (!zone.measure) return null
  const settings = await loadShippingSettings(tx, storeId)
  const policy = toShippingPolicy(settings)
  const lines = await cartLineKeys(tx, cartId)
  const cartKey = cartKeyOf(lines, zone.measure.valuePaise)
  const previous = opts.quoteId ? await readSnapshot(storeId, opts.quoteId) : null
  const reuse =
    previous &&
    previous.cartKey === cartKey &&
    previous.pincode === to.pincode &&
    previous.configVersion === config.version
      ? previous
      : null
  const { shipping } = await registriesForStore(tx, storeId)
  const providers = resolveShippingProviders(shipping, settings, env().SETTINGS_SECRET).providers
  const base = {
    config,
    cart: {
      ...zone.measure,
      items: await cartItemFacts(
        tx,
        lines.map((l) => l.variantId),
      ),
    },
    zone,
    policy,
    now: new Date(),
    declineInsurance: opts.declineInsurance,
  }
  const { result, answers } = reuse
    ? {
        result: resolveDeliveryOptions({ ...base, answers: reuse.answers }),
        answers: reuse.answers,
      }
    : await quoteDelivery({
        ...base,
        storeId,
        providers,
        cache: redisCache(),
        query: {
          originPincode: policy.originPincode,
          destinationPincode: to.pincode,
          ...zone.measure,
        },
      })
  const quoteId = reuse?.quoteId ?? crypto.randomUUID()
  const snapshot: DeliveryQuoteSnapshot = {
    quoteId,
    cartKey,
    pincode: to.pincode,
    configVersion: config.version,
    answers,
    shown: { ...(reuse?.shown ?? {}), ...shownPrices(result) },
    createdAt: reuse?.createdAt ?? new Date().toISOString(),
  }
  await cacheSet(
    sharedRedis(env().REDIS_URL),
    deliverySnapshotKey(storeId, quoteId),
    snapshot,
    DELIVERY_SNAPSHOT_TTL_SECONDS,
  )
  const first = result.options[0]
  return {
    zone,
    delivery: {
      quoteId,
      status: result.status,
      options: result.options,
      insurance: {
        offered: result.options.some((o) => o.insurance.offered),
        on: result.options.some((o) => o.insurance.offered && o.insurance.on),
        pricePaise: first?.insurance.pricePaise ?? null,
      },
    },
  }
}

/**
 * What `placeOrder` prices the shopper's choice from: the snapshot when it still matches the
 * cart and PIN code, else the answers read from cache only (no live courier call while
 * placing the order). Null when the app is off.
 */
export async function deliveryForOrder(
  tx: StoreTx,
  storeId: string,
  cartId: string,
  to: { pincode: string; stateCode: string },
  choice: (DeliveryChoice & { quoteId: string | null }) | null,
): Promise<{
  choice: DeliveryChoice
  answers: ProviderAnswer[]
  shown: Record<string, number> | null
} | null> {
  if (!choice) return null
  const config = await activeDeliveryConfig(tx, storeId)
  if (!config) return null
  const { quoteId, ...picked } = choice
  const snapshot = quoteId ? await readSnapshot(storeId, quoteId) : null
  const zone = await quoteCartShipping({ storeId, tx }, cartId, to)
  const lines = await cartLineKeys(tx, cartId)
  const cartKey = zone.measure ? cartKeyOf(lines, zone.measure.valuePaise) : ''
  if (snapshot && snapshot.cartKey === cartKey && snapshot.pincode === to.pincode) {
    return { choice: picked, answers: snapshot.answers, shown: snapshot.shown }
  }
  const settings = await loadShippingSettings(tx, storeId)
  const policy = toShippingPolicy(settings)
  const { shipping } = await registriesForStore(tx, storeId)
  const providers = resolveShippingProviders(shipping, settings, env().SETTINGS_SECRET).providers
  const answers = await gatherProviderAnswers(
    providers,
    {
      originPincode: policy.originPincode,
      destinationPincode: to.pincode,
      weightGrams: zone.measure?.weightGrams ?? 0,
      valuePaise: zone.measure?.valuePaise ?? 0,
      wantCod: true,
    },
    { storeId, cache: redisCache(), cacheOnly: true },
  )
  // A changed cart was never shown a price: it is charged what the cached answers say.
  return { choice: picked, answers, shown: null }
}
