import 'server-only'
import { loadEnv } from '@commerce/config'
import {
  activeDeliveryConfig,
  cartDeliveryParcels,
  cartItemFacts,
  cartKeyOf,
  cartLineKeys,
  cartParcelFor,
  DELIVERY_SNAPSHOT_TTL_SECONDS,
  type DeliveryChoice,
  type DeliveryQuoteSnapshot,
  type DeliveryResolveResult,
  deliverySnapshotKey,
  gatherProviderAnswers,
  type ProviderAnswer,
  type QuoteCache,
  type QuoteParcel,
  quoteCartShipping,
  quoteDelivery,
  quoteParcelDeliveries,
  type ResolvedOption,
  recordCheckoutQuote,
  resolveParcelDeliveries,
  resolveShippingProviders,
  type SnapshotParcel,
  shownPrices,
  toShippingPolicy,
} from '@commerce/core'
import { registriesForStore } from '@commerce/core/registries'
import type { StoreTx } from '@commerce/db'
import { cacheGet, cacheSet, deliveryQuoteCache, sharedRedis } from '@commerce/queue'
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

/** Quotes, the circuit breaker and each app's health, on the shared Redis. */
const redisCache = (): QuoteCache => deliveryQuoteCache(sharedRedis(env().REDIS_URL))

/** One sub-choice under an option card ("Blue Dart Air"). */
export type DeliveryChoiceCard = {
  routeKey: string
  label: string
  pricePaise: number
  arrives: string | null
  /** The courier's logo when its name is shown (list cards). */
  logo: CourierLogo | null
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
}

export type CourierLogo = {
  src: string
  alt: string /** Dark lettering: sits on a white tile. */
  light: boolean
}

/** Logos shipped in `public/courier-logos/`, by the carrier key `normaliseCarrier` gives. */
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

export function courierLogo(route: {
  carrierKey: string
  carrier: string
  showCarrier: boolean
}): CourierLogo | null {
  const logo = route.showCarrier ? COURIER_LOGOS[route.carrierKey] : undefined
  return logo
    ? { src: `/courier-logos/${logo.file}`, alt: route.carrier, light: logo.light === true }
    : null
}

export type CheckoutDelivery = {
  quoteId: string
  status: DeliveryResolveResult['status']
  options: ResolvedOption[]
  /** The checkbox under the cards: offered and ticked, with what it adds. */
  insurance: { offered: boolean; on: boolean; pricePaise: number | null }
}

/** "Delhivery", "Blue Dart Air": the carrier, with Air when the service flies. */
const choiceLabel = (route: {
  carrier: string
  showCarrier: boolean
  serviceLabel: string
}): string => {
  const air = /\bair\b/i.test(route.serviceLabel)
  // A courier the merchant hides is named by how it travels instead.
  if (!route.showCarrier) return air ? 'Air' : 'Surface'
  return air && !/\bair\b/i.test(route.carrier) ? `${route.carrier} Air` : route.carrier
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

export function cardExtras(
  o: ResolvedOption,
  policy: ReturnType<typeof toShippingPolicy>,
  now: Date,
  afterDiscount: (paise: number) => number,
): DeliveryCardExtras {
  return {
    codAllowed: o.codAllowed,
    codPricePaise: o.cod ? afterDiscount(o.cod.pricePaise) : null,
    codCarrier: o.cod?.route.showCarrier ? o.cod.route.carrier : null,
    listPricePaise: o.listPricePaise,
    optionName: o.name,
    logo: o.pick ? courierLogo(o.pick.route) : null,
    layout: o.layout,
    choices: o.choices.map((c) => ({
      routeKey: c.route.key,
      label: choiceLabel(c.route),
      pricePaise: afterDiscount(c.pricePaise),
      arrives: deliveryArrives(c, policy, now),
      logo: courierLogo(c.route),
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

type EngineBase = Parameters<typeof resolveParcelDeliveries>[0]
type Lines = Array<{ variantId: string; quantity: number }>
type Settings = Awaited<ReturnType<typeof loadShippingSettings>>

/** One parcel's engine cart: its value, billed weight (box included) and rule facts. */
async function parcelCart(
  tx: StoreTx,
  lines: Lines,
  valuePaise: number,
  boxes: Settings['boxPresets'],
) {
  /* Couriers bill the heavier of actual and volumetric weight: price the parcel the admin
     would book, box and packing included, not the bare products (#1546). Zone rates keep
     the cart's own weight (`zone.measure`). */
  const parcel = await cartParcelFor(tx, lines, boxes)
  const items = await cartItemFacts(
    tx,
    lines.map((l) => l.variantId),
  )
  return { parcel, cart: { valuePaise, weightGrams: parcel.billedGrams, items } }
}

/** The parcels of a cart that ships from more than one location; null for one (priced whole). */
async function splitParcels(
  tx: StoreTx,
  storeId: string,
  cartId: string,
  to: { pincode: string; stateCode: string },
  valuePaise: number,
  settings: Settings,
  storePincode: string,
): Promise<QuoteParcel[] | null> {
  const split = await cartDeliveryParcels(tx, storeId, cartId, {
    buyerState: to.stateCode,
    valuePaise,
    storePincode,
    boxPresets: settings.boxPresets,
  })
  if (split.length <= 1) return null
  return Promise.all(
    split.map(async (p) => ({
      key: p.key,
      lines: p.lines,
      originPincode: p.originPincode,
      valuePaise: p.valuePaise,
      weightGrams: p.parcel.billedGrams,
      dimensionsCm: p.parcel.dimensionsCm,
      cart: (await parcelCart(tx, p.lines, p.valuePaise, settings.boxPresets)).cart,
    })),
  )
}

/** A repeat ask (the insurance tick): the snapshot's answers, parcel by parcel when split. */
async function fromSnapshot(
  tx: StoreTx,
  snap: DeliveryQuoteSnapshot,
  base: EngineBase,
  lines: Lines,
  valuePaise: number,
  boxes: Settings['boxPresets'],
): Promise<{
  result: DeliveryResolveResult
  answers: ProviderAnswer[]
  parcels: SnapshotParcel[] | null
}> {
  const split = snap.parcels && snap.parcels.length > 1 ? snap.parcels : null
  const parts = split ?? [{ lines, valuePaise, answers: snap.answers }]
  const carts = await Promise.all(
    parts.map(async (p) => ({
      cart: (await parcelCart(tx, p.lines, p.valuePaise, boxes)).cart,
      answers: p.answers,
    })),
  )
  return {
    result: resolveParcelDeliveries(base, carts, valuePaise),
    answers: snap.answers,
    parcels: split,
  }
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
  const base = { config, zone, policy, now: new Date(), declineInsurance: opts.declineInsurance }
  const valuePaise = zone.measure.valuePaise
  // A cart that ships from two locations is two labels: each parcel is priced and added up.
  const split = reuse
    ? null
    : await splitParcels(tx, storeId, cartId, to, valuePaise, settings, policy.originPincode)
  const priced = reuse
    ? await fromSnapshot(tx, reuse, base, lines, valuePaise, settings.boxPresets)
    : split
      ? await quoteParcelDeliveries({
          ...base,
          storeId,
          providers,
          providerSettings: settings.providers,
          cache: redisCache(),
          destinationPincode: to.pincode,
          orderValuePaise: valuePaise,
          parcels: split,
        }).then(({ result, parcels }) => ({
          result,
          answers: parcels[0]?.answers ?? [],
          parcels,
        }))
      : await parcelCart(tx, lines, valuePaise, settings.boxPresets).then(
          async ({ parcel, cart }) => ({
            ...(await quoteDelivery({
              ...base,
              cart,
              storeId,
              providers,
              providerSettings: settings.providers,
              cache: redisCache(),
              query: {
                originPincode: policy.originPincode,
                destinationPincode: to.pincode,
                valuePaise,
                weightGrams: parcel.billedGrams,
                dimensionsCm: parcel.dimensionsCm,
              },
            })),
            parcels: null,
          }),
        )
  const { result, answers, parcels } = priced
  // For the app page's "share of checkouts on backup"; a repeat ask (insurance tick) is not counted.
  if (!reuse) void recordCheckoutQuote(redisCache(), storeId, result)
  const quoteId = reuse?.quoteId ?? crypto.randomUUID()
  const snapshot: DeliveryQuoteSnapshot = {
    quoteId,
    cartKey,
    pincode: to.pincode,
    configVersion: config.version,
    answers,
    ...(parcels ? { parcels } : {}),
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
  parcels: SnapshotParcel[] | null
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
    return {
      choice: picked,
      answers: snapshot.answers,
      shown: snapshot.shown,
      parcels: snapshot.parcels ?? null,
    }
  }
  const settings = await loadShippingSettings(tx, storeId)
  const policy = toShippingPolicy(settings)
  const { shipping } = await registriesForStore(tx, storeId)
  const providers = resolveShippingProviders(shipping, settings, env().SETTINGS_SECRET).providers
  const valuePaise = zone.measure?.valuePaise ?? 0
  // Split by location as checkout would, read from cache only (no courier call at Pay).
  const split = await splitParcels(
    tx,
    storeId,
    cartId,
    to,
    valuePaise,
    settings,
    policy.originPincode,
  )
  if (split) {
    const { parcels } = await quoteParcelDeliveries({
      config,
      zone,
      policy,
      now: new Date(),
      storeId,
      providers,
      providerSettings: settings.providers,
      cache: redisCache(),
      cacheOnly: true,
      destinationPincode: to.pincode,
      orderValuePaise: valuePaise,
      parcels: split,
    })
    return { choice: picked, answers: parcels[0]?.answers ?? [], shown: null, parcels }
  }
  // The same billed weight and box checkout asked with, so the cached answers are found.
  const parcel = await cartParcelFor(tx, lines, settings.boxPresets)
  const answers = await gatherProviderAnswers(
    providers,
    {
      originPincode: policy.originPincode,
      destinationPincode: to.pincode,
      weightGrams: parcel.billedGrams,
      dimensionsCm: parcel.dimensionsCm,
      valuePaise,
      wantCod: true,
    },
    { storeId, cache: redisCache(), cacheOnly: true, providerSettings: settings.providers },
  )
  // A changed cart was never shown a price: it is charged what the cached answers say.
  return { choice: picked, answers, shown: null, parcels: null }
}
