/** SOURCE OF TRUTH: Delivery options engine test fixtures — WHAT: a store calendar, courier
 * answers (Delhivery direct, Shiprocket's Delhivery / Bluedart Air / DTDC), option and rule
 * builders and a resolve input, the same numbers `resolve.test.ts` uses / WHY: the rule,
 * forced-route, free-price, insurance and courier-list tests share one cart and one set of
 * prices. Test-only; made-up data.
 */
import {
  type DeliveryConfig,
  type DeliveryOption,
  DeliveryOptionInputSchema,
  type RouteRule,
  RouteRuleInputSchema,
} from '../shipping/delivery-options/config'
import type {
  DeliveryResolveResult,
  ResolveInput,
} from '../shipping/delivery-options/resolve-types'
import type { ProviderAnswer, QuotedService } from '../shipping/delivery-options/routes'
import type { CartItemFacts } from '../shipping/delivery-options/rules'

/** Monday 2 Nov 2026, 10:00 IST: before the cut-off, every day a working and delivery day. */
export const NOW = new Date('2026-11-02T04:30:00Z')
export const POLICY = {
  cutoff: '18:00',
  timeZone: 'Asia/Kolkata',
  workingDays: [1, 2, 3, 4, 5, 6, 7],
  deliveryDays: [1, 2, 3, 4, 5, 6, 7],
  holidays: [],
  defaultMinTransitDays: 4,
  defaultMaxTransitDays: 6,
  codAllowed: true,
}

export const svc = (
  over: Partial<QuotedService> & Pick<QuotedService, 'serviceId' | 'serviceLabel'>,
): QuotedService => ({
  carrier: null,
  pricePaise: null,
  codPricePaise: null,
  insurancePaise: null,
  minTransitDays: null,
  maxTransitDays: null,
  codAvailable: true,
  ...over,
})

/** One quoted service in one line: id, label, price, transit days, the carrier behind it. */
export const quote = (
  serviceId: string,
  serviceLabel: string,
  pricePaise: number,
  [minTransitDays, maxTransitDays]: [number, number],
  carrier: string | null = null,
): QuotedService =>
  svc({ serviceId, serviceLabel, pricePaise, minTransitDays, maxTransitDays, carrier })

export const answer = (
  providerId: string,
  providerLabel: string,
  services: QuotedService[],
  over: Partial<ProviderAnswer> = {},
): ProviderAnswer => ({
  providerId,
  providerLabel,
  status: 'ok',
  source: 'live',
  ms: 300,
  error: null,
  serviceable: true,
  services,
  ...over,
})

/** Delhivery direct: Surface ₹60 (4–5 d), Express ₹102 (2–3 d). */
export const delhivery = () =>
  answer('delhivery', 'Delhivery', [
    svc({
      serviceId: 'S',
      serviceLabel: 'Surface',
      pricePaise: 6000,
      codPricePaise: 9000,
      minTransitDays: 4,
      maxTransitDays: 5,
    }),
    svc({
      serviceId: 'E',
      serviceLabel: 'Express',
      pricePaise: 10200,
      minTransitDays: 2,
      maxTransitDays: 3,
    }),
  ])

/** Shiprocket: Delhivery Surface ₹80, Bluedart Air ₹128 (1–2 d), DTDC Surface ₹55 (5–6 d, no
 *  COD). */
export const shiprocket = (dtdcPaise = 5500) =>
  answer('shiprocket', 'Shiprocket', [
    svc({
      serviceId: '10',
      serviceLabel: 'Delhivery Surface',
      carrier: 'Delhivery Surface',
      pricePaise: 8000,
      codPricePaise: 10000,
      minTransitDays: 4,
      maxTransitDays: 5,
    }),
    svc({
      serviceId: '20',
      serviceLabel: 'Bluedart Air',
      carrier: 'Bluedart Air',
      pricePaise: 12800,
      minTransitDays: 1,
      maxTransitDays: 2,
    }),
    svc({
      serviceId: '30',
      serviceLabel: 'DTDC Surface',
      carrier: 'DTDC Surface',
      pricePaise: dtdcPaise,
      minTransitDays: 5,
      maxTransitDays: 6,
      codAvailable: false,
    }),
  ])

export const option = (
  id: string,
  input: Record<string, unknown>,
  position = 0,
): DeliveryOption => ({
  ...DeliveryOptionInputSchema.parse(input),
  id,
  position,
})

export const STANDARD = option('std', { name: 'Standard', speed: 'standard', strategy: 'cheapest' })
export const EXPRESS = option(
  'exp',
  { name: 'Express', speed: 'express', strategy: 'fastest', cod: { mode: 'prepaid_only' } },
  1,
)

export const rule = (id: string, input: Record<string, unknown>, position: number): RouteRule => ({
  ...RouteRuleInputSchema.parse(input),
  id,
  position,
})

export const item = (
  productId: string,
  collectionIds: string[] = [],
  tags: string[] = [],
): CartItemFacts => ({
  productId,
  collectionIds,
  tags,
  productType: null,
})

export const config = (over: Partial<DeliveryConfig> = {}): DeliveryConfig => ({
  options: [STANDARD, EXPRESS],
  rules: [],
  routeSettings: [],
  version: 'v1',
  ...over,
})

export const input = (over: Partial<ResolveInput> = {}): ResolveInput => ({
  config: config(),
  cart: { valuePaise: 150_000, weightGrams: 400, items: [item('p1')] },
  answers: [delhivery(), shiprocket()],
  zone: {
    kind: 'rates',
    options: [
      {
        rateId: 'rate-1',
        name: 'Standard',
        zoneId: 'z',
        zoneName: 'India',
        listPricePaise: 4900,
        pricePaise: 4900,
        codSurchargePaise: null,
        minTransitDays: null,
        maxTransitDays: null,
      },
    ],
  },
  policy: POLICY,
  now: NOW,
  ...over,
})

export const find = (r: DeliveryResolveResult, id: string) =>
  r.options.find((o) => o.optionId === id)

export const traceOf = (r: DeliveryResolveResult, optionId: string) =>
  r.trace.options.find((o) => o.optionId === optionId)
