/** SOURCE OF TRUTH: checkout's courier questions — WHAT: asks every connected domestic courier
 * app for a PIN code at once (its services, prices for prepaid and COD, serviceability), each
 * within the checkout deadline, and remembers the answers by weight slab and value bucket /
 * WHY: checkout must never wait more than about a second on couriers, and one slow app must
 * never blank the Shipping step. A late answer still lands in the cache for the next shopper.
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
import { halfKgSteps, type ProviderAnswer, type QuotedService } from './routes'

/** Per call at checkout. Booking keeps the adapters' own 6 s timeout. */
const CHECKOUT_COURIER_DEADLINE_MS = 800
/** Live prices and serviceability, per app, origin>PIN, slab and value bucket. */
const DELIVERY_QUOTE_TTL_SECONDS = 6 * 3600

export type QuoteCache = {
  get<T>(key: string): Promise<T | null>
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>
}

export type CheckoutQuoteQuery = {
  originPincode: string
  destinationPincode: string
  weightGrams: number
  valuePaise: number
  /** Ask the COD price too (some option allows cash on delivery). */
  wantCod: boolean
}

type CachedAnswer = Pick<ProviderAnswer, 'serviceable' | 'services'>

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
    'originPincode' | 'destinationPincode' | 'weightGrams' | 'valuePaise'
  >,
): string =>
  `{shipping}:delivery-quote:v1:${storeId}:${providerId}:${q.originPincode}>${q.destinationPincode}:${halfKgSteps(q.weightGrams) * 500}g:${valueBucket(q.valuePaise)}`

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
 * Every domestic app's answer for this PIN code, in parallel. Each is read from the cache,
 * else asked live within `deadlineMs`; a miss is `failed` (never "not serviceable"), and the
 * call keeps running so its answer is cached when it lands. `cacheOnly` (placing an order
 * without a quote snapshot) never calls a courier.
 */
export async function gatherProviderAnswers(
  providers: readonly ShippingProvider[],
  query: CheckoutQuoteQuery,
  opts: {
    storeId: string
    cache?: QuoteCache | null | undefined
    deadlineMs?: number | undefined
    cacheOnly?: boolean | undefined
  },
): Promise<ProviderAnswer[]> {
  const deadline = opts.deadlineMs ?? CHECKOUT_COURIER_DEADLINE_MS
  const domestic = providers.filter((p) => servesDestination(p, 'IN') && !p.requiresTrackingNumber)
  return Promise.all(
    domestic.map(async (provider): Promise<ProviderAnswer> => {
      const base = { providerId: provider.id, providerLabel: provider.label }
      const key = deliveryQuoteKey(opts.storeId, provider.id, query)
      const cached = opts.cache ? await opts.cache.get<CachedAnswer>(key).catch(() => null) : null
      if (cached)
        return { ...base, ...cached, status: 'ok', source: 'cache', ms: null, error: null }
      if (opts.cacheOnly) {
        return {
          ...base,
          status: 'failed',
          source: 'cache',
          ms: null,
          error: 'No cached answer',
          serviceable: null,
          services: [],
        }
      }
      const started = Date.now()
      const work = askProvider(provider, query)
      // Late or not, a real answer is remembered for the next shopper.
      work
        .then((answer) => opts.cache?.set(key, answer, DELIVERY_QUOTE_TTL_SECONDS))
        .catch(() => undefined)
      let timer: ReturnType<typeof setTimeout> | undefined
      const late = new Promise<typeof TIMED_OUT>((resolve) => {
        timer = setTimeout(() => resolve(TIMED_OUT), deadline)
      })
      try {
        const answer = await Promise.race([work, late])
        if (answer === TIMED_OUT) {
          return {
            ...base,
            status: 'failed',
            source: 'live',
            ms: null,
            error: `No answer within ${deadline} ms`,
            serviceable: null,
            services: [],
          }
        }
        return {
          ...base,
          ...answer,
          status: 'ok',
          source: 'live',
          ms: Date.now() - started,
          error: null,
        }
      } catch (err) {
        return {
          ...base,
          status: 'failed',
          source: 'live',
          ms: Date.now() - started,
          error: describeCourierFailure(err),
          serviceable: null,
          services: [],
        }
      } finally {
        clearTimeout(timer)
      }
    }),
  )
}
