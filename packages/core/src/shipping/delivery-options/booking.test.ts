/** SOURCE OF TRUTH: delivery option booking tests — WHAT: the saved route among the rate rows, its failure reason and fallback, product rules for orders without a route / WHY: booking must match what the shopper paid for. */
import { describe, expect, it } from 'vitest'
import type { CourierRateRow } from '../courier-rates'
import { type BookingContext, bookingPlan, rowRoute } from './booking'
import { DeliveryOptionInputSchema, RouteRuleInputSchema } from './config'

const row = (
  over: Partial<CourierRateRow> & Pick<CourierRateRow, 'providerId'>,
): CourierRateRow => ({
  optionKey: `${over.providerId}:${over.serviceId ?? ''}`,
  providerName: over.providerId,
  providerLabel: over.providerId,
  serviceId: null,
  charges: [],
  chargeableWeightGrams: null,
  pricePaise: 10000,
  minTransitDays: 2,
  maxTransitDays: 3,
  codAvailable: true,
  problem: null,
  problemDetail: null,
  deliveryBy: '2026-11-04',
  etaFromSettings: false,
  badges: [],
  ...over,
})

const ROWS: CourierRateRow[] = [
  row({
    providerId: 'delhivery',
    providerName: 'Delhivery',
    serviceId: 'E',
    serviceLabel: 'Express',
    pricePaise: 10200,
    deliveryBy: '2026-11-05',
  }),
  row({
    providerId: 'shiprocket',
    providerName: 'Shiprocket',
    serviceId: '20',
    serviceLabel: 'Bluedart Air',
    carrier: 'Bluedart Air',
    pricePaise: 12800,
    deliveryBy: '2026-11-04',
  }),
  row({
    providerId: 'shiprocket',
    providerName: 'Shiprocket',
    serviceId: '30',
    serviceLabel: 'DTDC Surface',
    carrier: 'DTDC Surface',
    pricePaise: 5500,
  }),
]

const EXPRESS = {
  ...DeliveryOptionInputSchema.parse({ name: 'Express', speed: 'express', strategy: 'fastest' }),
  id: 'exp',
  position: 1,
}

const ctx = (over: Partial<BookingContext> = {}): BookingContext => ({
  delivery: {
    optionId: 'exp',
    optionName: 'Express',
    route: {
      key: 'shiprocket:20',
      providerId: 'shiprocket',
      channel: 'aggregator',
      carrier: 'Blue Dart',
      serviceId: '20',
      serviceLabel: 'Bluedart Air',
    },
    pickedBy: 'shopper',
    insured: true,
    insurancePaise: null,
    markupPaise: 0,
    courierCostPaise: 12800,
    promisedEarliest: null,
    promisedLatest: null,
    quoteSource: 'live',
  },
  option: EXPRESS,
  rules: [],
  settings: [],
  ...over,
})

describe('bookingPlan', () => {
  it('finds the route saved at checkout among the rate rows', () => {
    const plan = bookingPlan(ROWS, ctx(), { insured: true })
    expect(plan).toMatchObject({
      chosenKey: 'shiprocket:20',
      chosenProblem: null,
      fallbackKey: null,
    })
  })

  it('a saved route that fails gives the reason and the next route that still fits', () => {
    const failing = ROWS.map((r) =>
      r.optionKey === 'shiprocket:20'
        ? { ...r, problem: 'not_serviceable' as const, problemDetail: 'pincode not serviceable' }
        : r,
    )
    const plan = bookingPlan(failing, ctx(), { insured: true })
    expect(plan.chosenKey).toBeNull()
    expect(plan.chosenProblem).toBe('pincode not serviceable')
    // Express needs an express route that insures: Delhivery Express direct, not DTDC Surface.
    expect(plan.fallbackKey).toBe('delhivery:E')
  })

  it('a route whose app is gone is not offered', () => {
    const plan = bookingPlan(
      ROWS.filter((r) => r.providerId !== 'shiprocket'),
      ctx(),
      { insured: true },
    )
    expect(plan.chosenProblem).toBe('not_offered')
  })

  it('orders without a route still follow product route rules (Glasspads only on Delhivery)', () => {
    const glass = {
      ...RouteRuleInputSchema.parse({
        name: 'Glasspads',
        target: { kind: 'collections', values: ['c'] },
        routes: [{ carrier: 'delhivery' }],
      }),
      id: 'g',
      position: 0,
    }
    const plan = bookingPlan(ROWS, ctx({ delivery: null, option: null, rules: [glass] }), {
      insured: false,
    })
    expect(plan.allowedKeys).toEqual(['delhivery:E'])
    expect(plan.chosenKey).toBeNull()
  })

  it('reads a row as a route: carrier behind the aggregator, speed, insurance', () => {
    const r = rowRoute(ROWS[1] as CourierRateRow, [])
    expect(r).toMatchObject({
      carrier: 'Blue Dart',
      channel: 'aggregator',
      speed: 'express',
      insures: true,
    })
  })
})
