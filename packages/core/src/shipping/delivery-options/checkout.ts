/** SOURCE OF TRUTH: delivery options at checkout and at place order — WHAT: `quoteDelivery`
 * gathers the courier answers and runs the engine for a cart and address; the quote snapshot
 * (what was asked, what was answered, what the shopper was shown) is what `placeOrder` prices
 * from; `orderDeliveryFor` turns the shopper's choice into the price charged and the route
 * saved on the order / WHY: `placeOrder` must never call a courier inside its transaction and
 * must never charge more than the shopper saw.
 */
import type { OrderDeliveryRoute } from '@commerce/db'
import type { ShippingProvider } from '@commerce/shipping'
import type { ShippingRateOption } from '../rates'
import type { DeliveryConfig } from './config'
import { type DeliveryParcelInput, resolveParcelDeliveries } from './parcels'
import { type CheckoutQuoteQuery, gatherProviderAnswers, type QuoteCache } from './quotes'
import { chosenRoute, resolveDeliveryOptions } from './resolve'
import type { DeliveryResolveResult, ResolvedOption, ResolveInput } from './resolve-types'
import type { ProviderAnswer } from './routes'

/** How long checkout's computed options stay good for `placeOrder`. */
export const DELIVERY_SNAPSHOT_TTL_SECONDS = 30 * 60

export type DeliveryQuoteSnapshot = {
  quoteId: string
  /** Variant ids and quantities and the value: a changed cart is not this quote. */
  cartKey: string
  pincode: string
  configVersion: string
  answers: ProviderAnswer[]
  /**
   * A cart shipping from more than one location: each parcel's lines, value and courier answers
   * (`answers` is then the first parcel's). Absent: one parcel, priced from `answers`.
   */
  parcels?: SnapshotParcel[] | undefined
  /** The price each choice was shown at, by `choiceKey`. Never charge more. */
  shown: Record<string, number>
  createdAt: string
}

export type DeliveryChoice = {
  optionId: string
  /** A sub-choice's route key; null takes the option's own pick. */
  routeKey: string | null
  /** The shopper's tick; a rule that requires insurance keeps it on whatever this says. */
  insured: boolean
}

const choiceKey = (
  optionId: string,
  routeKey: string | null,
  insured: boolean,
  payment: 'prepaid' | 'cod',
): string => `${optionId}|${routeKey ?? ''}|${insured ? 'i' : '-'}|${payment}`

export const deliverySnapshotKey = (storeId: string, quoteId: string): string =>
  `{shipping}:delivery-snapshot:${storeId}:${quoteId}`

/** A cart's identity for the snapshot: lines and value. */
export function cartKeyOf(
  lines: ReadonlyArray<{ variantId: string; quantity: number }>,
  valuePaise: number,
): string {
  return [...lines]
    .map((l) => `${l.variantId}x${l.quantity}`)
    .sort()
    .concat(String(valuePaise))
    .join(',')
}

/** Every price this result shows, for the snapshot. */
export function shownPrices(result: DeliveryResolveResult): Record<string, number> {
  const out: Record<string, number> = {}
  for (const o of result.options) {
    const insured = o.insurance.on
    out[choiceKey(o.optionId, null, insured, 'prepaid')] = o.pricePaise
    for (const c of o.choices)
      out[choiceKey(o.optionId, c.route.key, insured, 'prepaid')] = c.pricePaise
    if (o.codAllowed)
      out[choiceKey(o.optionId, null, insured, 'cod')] = o.cod?.pricePaise ?? o.pricePaise
  }
  return out
}

export type QuoteDeliveryInput = Omit<ResolveInput, 'answers'> & {
  storeId: string
  providers: readonly ShippingProvider[]
  query: Omit<CheckoutQuoteQuery, 'wantCod'>
  cache?: QuoteCache | null | undefined
  cacheOnly?: boolean | undefined
  deadlineMs?: number | undefined
}

/** Ask the couriers (or the cache) and run the engine. */
export async function quoteDelivery(
  input: QuoteDeliveryInput,
): Promise<{ result: DeliveryResolveResult; answers: ProviderAnswer[] }> {
  const wantCod =
    input.policy.codAllowed &&
    input.config.options.some((o) => o.speed === 'standard' && o.cod.mode === 'allowed')
  const answers = await gatherProviderAnswers(
    input.providers,
    { ...input.query, wantCod },
    {
      storeId: input.storeId,
      cache: input.cache,
      cacheOnly: input.cacheOnly,
      deadlineMs: input.deadlineMs,
    },
  )
  return { result: resolveDeliveryOptions({ ...input, answers }), answers }
}

/** One parcel of a split cart in the snapshot: what place order re-prices it from. */
export type SnapshotParcel = {
  key: string
  lines: Array<{ variantId: string; quantity: number }>
  valuePaise: number
  answers: ProviderAnswer[]
}

/** A parcel of a split cart, ready to ask the couriers about. */
export type QuoteParcel = {
  key: string
  lines: Array<{ variantId: string; quantity: number }>
  originPincode: string
  valuePaise: number
  weightGrams: number
  dimensionsCm?: CheckoutQuoteQuery['dimensionsCm']
  cart: DeliveryParcelInput['cart']
}

/**
 * A cart shipping as several parcels: every parcel's couriers asked at once (each within the
 * same checkout deadline, so the wait is the slowest parcel, not the sum), then the cards added
 * up per option (`resolveParcelDeliveries`).
 */
export async function quoteParcelDeliveries(
  input: Omit<QuoteDeliveryInput, 'query' | 'cart'> & {
    destinationPincode: string
    orderValuePaise: number
    parcels: readonly QuoteParcel[]
  },
): Promise<{ result: DeliveryResolveResult; parcels: SnapshotParcel[] }> {
  const wantCod =
    input.policy.codAllowed &&
    input.config.options.some((o) => o.speed === 'standard' && o.cod.mode === 'allowed')
  const answered = await Promise.all(
    input.parcels.map((p) =>
      gatherProviderAnswers(
        input.providers,
        {
          originPincode: p.originPincode,
          destinationPincode: input.destinationPincode,
          weightGrams: p.weightGrams,
          dimensionsCm: p.dimensionsCm,
          valuePaise: p.valuePaise,
          wantCod,
        },
        {
          storeId: input.storeId,
          cache: input.cache,
          cacheOnly: input.cacheOnly,
          deadlineMs: input.deadlineMs,
        },
      ),
    ),
  )
  const { config, zone, policy, now, declineInsurance } = input
  const result = resolveParcelDeliveries(
    { config, zone, policy, now, declineInsurance },
    input.parcels.map((p, i) => ({ cart: p.cart, answers: answered[i] ?? [] })),
    input.orderValuePaise,
  )
  return {
    result,
    parcels: input.parcels.map((p, i) => ({
      key: p.key,
      lines: p.lines,
      valuePaise: p.valuePaise,
      answers: answered[i] ?? [],
    })),
  }
}

/** Why a choice could not be honoured at place order. */
export type DeliveryChoiceProblem = 'option_gone' | 'prepaid_only'

/**
 * What the order charges and saves for the shopper's choice, from a result computed on the
 * snapshot's answers. The price is the lower of now and what was shown.
 */
export function orderDeliveryFor(
  result: DeliveryResolveResult,
  choice: DeliveryChoice,
  payment: 'prepaid' | 'cod',
  shown: Record<string, number> | null,
  config: Pick<DeliveryConfig, 'options'>,
):
  | {
      ok: true
      shipping: ShippingRateOption
      delivery: OrderDeliveryRoute
      backupRateId: string | null
    }
  | { ok: false; problem: DeliveryChoiceProblem } {
  const option: ResolvedOption | undefined = result.options.find(
    (o) => o.optionId === choice.optionId,
  )
  if (!option) return { ok: false, problem: 'option_gone' }
  if (payment === 'cod' && !option.codAllowed) return { ok: false, problem: 'prepaid_only' }
  const priced = chosenRoute(option, choice.routeKey, payment)
  const nowPrice = priced?.pricePaise ?? option.pricePaise
  const shownKey = choiceKey(
    option.optionId,
    payment === 'cod' ? null : choice.routeKey,
    option.insurance.on,
    payment,
  )
  const was = shown?.[shownKey]
  const price = was === undefined ? nowPrice : Math.min(nowPrice, was)
  const saved = config.options.find((o) => o.id === option.optionId)
  const shopperPicked =
    !!choice.routeKey && priced !== null && priced.route.key !== option.pick?.route.key
  const backup = option.backupRate
  const r = priced?.route ?? null
  return {
    ok: true,
    backupRateId: backup?.rateId ?? null,
    shipping: {
      rateId: option.optionId,
      name: r ? `${option.name} · ${r.carrier}` : option.name,
      zoneId: backup?.zoneId ?? '',
      zoneName: backup?.zoneName ?? '',
      listPricePaise: Math.max(price, priced?.listPricePaise ?? option.listPricePaise),
      pricePaise: price,
      codSurchargePaise: null,
      minTransitDays: backup?.minTransitDays ?? null,
      maxTransitDays: backup?.maxTransitDays ?? null,
    },
    delivery: {
      optionId: option.optionId,
      optionName: saved?.name ?? option.name,
      route: r
        ? {
            key: r.key,
            providerId: r.providerId,
            channel: r.channel,
            carrier: r.carrier,
            serviceId: r.serviceId,
            serviceLabel: r.serviceLabel,
          }
        : null,
      pickedBy: !r ? 'backup' : shopperPicked ? 'shopper' : option.pickedBy,
      insured: priced?.insured ?? false,
      insurancePaise: priced ? priced.insurancePaise : null,
      markupPaise: priced?.markupPaise ?? 0,
      courierCostPaise: priced?.courierCostPaise ?? null,
      promisedEarliest: priced?.earliest ?? option.earliest,
      promisedLatest: priced?.latest ?? option.latest,
      quoteSource: option.source,
    },
  }
}
