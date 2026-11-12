/** SOURCE OF TRUTH: checkout's courier questions — WHAT: asks every connected domestic courier
 * app for a PIN code at once (its services, prices for prepaid and COD, serviceability), each
 * within the checkout deadline, and remembers the answers by billed-weight slab, box and value bucket /
 * WHY: checkout must never wait more than about a second on couriers, and one slow app must
 * never blank the Shipping step. A late answer still lands in the cache for the next shopper.
 * An answer older than 6 h is stale: it is asked again live, and used (up to 7 days old) when
 * the live call misses its deadline or fails. An app whose breaker is open is not asked.
 * The cache is passed in (the storefront gives Redis) so core stays free of a Redis client.
 */
import {
  ASSUMED_WEIGHT_GRAMS,
  describeCourierFailure,
  type RateOption,
  type RateQuery,
  type Serviceability,
  type ShippingProvider,
  servesDestination,
} from '@commerce/shipping'
import { courierSettingsFingerprint } from '../courier-fingerprint'
import type { PackageDimensionsCm } from '../parcel'
import { breakerOpen, type HealthStore, recordCourierCall } from './health'
import { halfKgSteps, type ProviderAnswer, type QuotedService } from './routes'

/** Per call at checkout. Booking keeps the adapters' own 6 s timeout. */
const CHECKOUT_COURIER_DEADLINE_MS = 800
/**
 * When nothing is cached for this app and PIN code (not even stale), waiting the short
 * deadline only drops the app: RapidShyp answers in 1.8–2 s, so its couriers were missing for
 * every first shopper at a PIN. With nothing to stand in, the first ask waits this long; later
 * shoppers get the cached answer at once and the refresh runs behind.
 */
const CHECKOUT_COLD_DEADLINE_MS = 2500
/** Live prices and serviceability, per app, origin>PIN, slab and value bucket: fresh for 6 h. */
export const DELIVERY_QUOTE_FRESH_MS = 6 * 3600 * 1000
/** Kept (stale-while-revalidate) for 7 days, for when the live call misses its deadline. */
const DELIVERY_QUOTE_TTL_SECONDS = 7 * 24 * 3600

/** Redis, as the storefront gives it: JSON get/set plus the breaker and health calls. */
export type QuoteCache = HealthStore

export type CheckoutQuoteQuery = {
  originPincode: string
  destinationPincode: string
  /** The weight the courier bills: the heavier of actual and the box's volumetric (#1546). */
  weightGrams: number
  /** The parcel's box, sent to couriers that take it; part of the cache key. */
  dimensionsCm?: PackageDimensionsCm | null | undefined
  valuePaise: number
  /** Ask the COD price too (some option allows cash on delivery). */
  wantCod: boolean
}

type CachedAnswer = Pick<ProviderAnswer, 'serviceable' | 'services'>
/** What the cache holds: the answer and when it was asked (epoch ms). */
type CachedEntry = { at: number; answer: CachedAnswer }

/** COD charges and insurance depend on value: ₹0–2k, ₹2–5k, ₹5k+. */
export function valueBucket(valuePaise: number): string {
  if (valuePaise < 200_000) return '0-2k'
  if (valuePaise < 500_000) return '2-5k'
  return '5k+'
}

export const deliveryQuoteKey = (
  storeId: string,
  providerId: string,
  q: Pick<
    CheckoutQuoteQuery,
    'originPincode' | 'destinationPincode' | 'weightGrams' | 'valuePaise' | 'dimensionsCm'
  >,
  /** The courier app's saved settings as stored (`ShippingSettings.providers[id]`); hashed in. */
  providerSettings?: unknown,
): string =>
  `{shipping}:delivery-quote:v3:${storeId}:${providerId}:${courierSettingsFingerprint(providerSettings)}:${q.originPincode}>${q.destinationPincode}:${halfKgSteps(q.weightGrams) * 500}g:${valueBucket(q.valuePaise)}${boxKey(q.dimensionsCm)}`

/** The box in the cache key, so a bigger box is never served a small box's price. No box: as before. */
const boxKey = (d: PackageDimensionsCm | null | undefined): string =>
  d ? `:${d.lengthCm}x${d.widthCm}x${d.heightCm}cm` : ''

const insuranceLine = (o: RateOption): number | null => {
  const lines = o.charges.filter((c) => c.kind === 'insurance')
  return lines.length ? lines.reduce((s, c) => s + c.pricePaise, 0) : null
}

/** One app's answer, all its calls at once. Throws when nothing at all answered. */
async function askProvider(
  provider: ShippingProvider,
  q: CheckoutQuoteQuery,
): Promise<CachedAnswer> {
  const rate = (paymentMode: 'prepaid' | 'cod'): RateQuery => ({
    originPincode: q.originPincode,
    destinationPincode: q.destinationPincode,
    weightGrams: q.weightGrams || ASSUMED_WEIGHT_GRAMS,
    declaredValuePaise: q.valuePaise,
    paymentMode,
    ...(q.dimensionsCm
      ? {
          dimensionsCm: {
            length: q.dimensionsCm.lengthCm,
            width: q.dimensionsCm.widthCm,
            height: q.dimensionsCm.heightCm,
          },
        }
      : {}),
  })
  const served = provider.checkServiceability({
    originPincode: q.originPincode,
    destinationPincode: q.destinationPincode,
    weightGrams: q.weightGrams,
    declaredValue: Math.round(q.valuePaise / 100),
  })
  if (provider.quoteOptions) {
    const ask = provider.quoteOptions.bind(provider)
    const [pre, cod, svc] = await Promise.allSettled([
      ask(rate('prepaid')),
      q.wantCod ? ask(rate('cod')) : Promise.resolve([] as RateOption[]),
      served,
    ])
    const service: Serviceability | null = svc.status === 'fulfilled' ? svc.value : null
    if (pre.status === 'rejected' && !service) throw pre.reason
    const options = pre.status === 'fulfilled' ? pre.value : []
    const codById = new Map(
      (cod.status === 'fulfilled' ? cod.value : []).map((o) => [o.serviceId, o.pricePaise]),
    )
    return {
      serviceable: service ? service.serviceable : options.length > 0 ? true : null,
      services: options.map(
        (o): QuotedService => ({
          serviceId: o.serviceId,
          serviceLabel: o.serviceLabel,
          carrier: o.carrier,
          pricePaise: o.pricePaise,
          codPricePaise: codById.get(o.serviceId) ?? null,
          insurancePaise: insuranceLine(o),
          minTransitDays: o.minTransitDays ?? service?.minTransitDays ?? null,
          maxTransitDays: o.maxTransitDays ?? service?.maxTransitDays ?? null,
          codAvailable: o.codAvailable ?? service?.codAvailable ?? null,
        }),
      ),
    }
  }
  const quote = provider.quoteRate?.bind(provider)
  const [pre, cod, svc] = await Promise.allSettled([
    quote ? quote(rate('prepaid')) : Promise.resolve(null),
    quote && q.wantCod ? quote(rate('cod')) : Promise.resolve(null),
    served,
  ])
  const service = svc.status === 'fulfilled' ? svc.value : null
  const price = pre.status === 'fulfilled' ? pre.value : null
  if (!service && !price) throw svc.status === 'rejected' ? svc.reason : new Error('no answer')
  return {
    serviceable: service ? service.serviceable : true,
    services: [
      {
        serviceId: '',
        serviceLabel: provider.label,
        carrier: null,
        pricePaise: price?.pricePaise ?? null,
        codPricePaise: cod.status === 'fulfilled' ? (cod.value?.pricePaise ?? null) : null,
        insurancePaise: null,
        minTransitDays: price?.minTransitDays ?? service?.minTransitDays ?? null,
        maxTransitDays: price?.maxTransitDays ?? service?.maxTransitDays ?? null,
        codAvailable: service?.codAvailable ?? null,
      },
    ],
  }
}

const TIMED_OUT = Symbol('timed out')

/**
 * Every domestic app's answer for this PIN code, in parallel. A fresh cached answer is used
 * as is; otherwise the app is asked live within `deadlineMs`, and when that misses (or the
 * app's breaker is open) a stale cached answer stands in, else the app is `failed` (never "not
 * serviceable"). The live call keeps running so its answer is cached when it lands, and it is
 * recorded for the breaker by how it ends, not by the deadline.
 * `cacheOnly` (placing an order without a quote snapshot) never calls a courier and takes any
 * cached answer, stale or not.
 */
export async function gatherProviderAnswers(
  providers: readonly ShippingProvider[],
  query: CheckoutQuoteQuery,
  opts: {
    storeId: string
    cache?: QuoteCache | null | undefined
    deadlineMs?: number | undefined
    cacheOnly?: boolean | undefined
    /**
     * The store's saved courier settings by app id (`ShippingSettings.providers`), hashed into
     * each app's cache key so new credentials or options are never answered from the old ones.
     */
    providerSettings?: Readonly<Record<string, unknown>> | undefined
    /** Epoch ms; tests pass a clock. */
    now?: (() => number) | undefined
  },
): Promise<ProviderAnswer[]> {
  const shortDeadline = opts.deadlineMs ?? CHECKOUT_COURIER_DEADLINE_MS
  const now = opts.now ?? Date.now
  const cache = opts.cache ?? null
  const domestic = providers.filter((p) => servesDestination(p, 'IN') && !p.requiresTrackingNumber)
  return Promise.all(
    domestic.map(async (provider): Promise<ProviderAnswer> => {
      const base = { providerId: provider.id, providerLabel: provider.label }
      const key = deliveryQuoteKey(
        opts.storeId,
        provider.id,
        query,
        opts.providerSettings?.[provider.id],
      )
      const failed = (error: string, ms: number | null = null): ProviderAnswer => ({
        ...base,
        status: 'failed',
        source: opts.cacheOnly ? 'cache' : 'live',
        ms,
        error,
        serviceable: null,
        services: [],
      })
      const [entry, open] = await Promise.all([
        cache ? cache.get<CachedEntry>(key).catch(() => null) : null,
        cache && !opts.cacheOnly ? breakerOpen(cache, opts.storeId, provider.id) : null,
      ])
      const fromCache = (stale: boolean, why: string | null): ProviderAnswer | null =>
        entry?.answer
          ? { ...base, ...entry.answer, status: 'ok', source: 'cache', ms: null, error: why, stale }
          : null
      if (entry?.answer && now() - entry.at < DELIVERY_QUOTE_FRESH_MS) {
        return fromCache(false, null) as ProviderAnswer
      }
      if (opts.cacheOnly) return fromCache(true, null) ?? failed('No cached answer')
      if (open) {
        const why = `Skipped since ${open.since}: failing`
        return fromCache(true, why) ?? failed(why)
      }
      // Nothing cached to stand in: wait longer rather than drop the app (RapidShyp).
      const deadline =
        entry?.answer || opts.deadlineMs !== undefined
          ? shortDeadline
          : Math.max(shortDeadline, CHECKOUT_COLD_DEADLINE_MS)
      const started = now()
      const work = askProvider(provider, query)
      const record = (ok: boolean, error: string | null) => {
        if (cache)
          void recordCourierCall(cache, opts.storeId, provider.id, {
            at: started,
            ok,
            ms: now() - started,
            error,
          })
      }
      // The breaker and health line judge the call itself, not checkout's deadline: a late answer
      // is a success (RapidShyp answers in ~2 s), only a real error or the adapter's own timeout
      // is a failure. Late or not, a real answer is remembered for the next shopper (#1524).
      work
        .then(
          (answer) => {
            record(true, null)
            return cache?.set(
              key,
              { at: now(), answer } satisfies CachedEntry,
              DELIVERY_QUOTE_TTL_SECONDS,
            )
          },
          (err) => record(false, describeCourierFailure(err)),
        )
        .catch(() => undefined)
      let timer: ReturnType<typeof setTimeout> | undefined
      const late = new Promise<typeof TIMED_OUT>((resolve) => {
        timer = setTimeout(() => resolve(TIMED_OUT), deadline)
      })
      try {
        const answer = await Promise.race([work, late])
        if (answer === TIMED_OUT) {
          const why = `No answer within ${deadline} ms`
          return fromCache(true, why) ?? failed(why)
        }
        const ms = now() - started
        return { ...base, ...answer, status: 'ok', source: 'live', ms, error: null }
      } catch (err) {
        const ms = now() - started
        const why = describeCourierFailure(err)
        return fromCache(true, why) ?? failed(why, ms)
      } finally {
        clearTimeout(timer)
      }
    }),
  )
}
