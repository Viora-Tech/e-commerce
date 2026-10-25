import type { CourierRateRow } from '@commerce/core'
import { describe, expect, it } from 'vitest'
import {
  bulkOrders,
  bulkPicks,
  bulkSplit,
  CUSTOM_BOX,
  courierTotals,
  type DraftOrder,
  type DraftParcel,
  MANUAL,
  type ParcelQuote,
  PRODUCT_BOX,
  packageFor,
  parsePackage,
  quoteRequest,
  type ShipmentDraft,
  startingBulkPick,
  startingPick,
  withBox,
} from './flow-state'

const row = (over: Partial<CourierRateRow> & { providerId: string }): CourierRateRow => ({
  optionKey: over.serviceId ? `${over.providerId}:${over.serviceId}` : over.providerId,
  providerName: over.providerId,
  providerLabel: over.providerId,
  serviceId: null,
  charges: [],
  chargeableWeightGrams: null,
  pricePaise: null,
  minTransitDays: null,
  maxTransitDays: null,
  codAvailable: null,
  problem: null,
  problemDetail: null,
  deliveryBy: null,
  etaFromSettings: false,
  badges: [],
  ...over,
})

const parcel = (over: Partial<DraftParcel> = {}): DraftParcel => ({
  id: 'p1',
  position: 1,
  locationName: 'Jaipur warehouse',
  lines: [{ id: 'l1', title: 'Kurta / M', quantity: 2 }],
  valuePaise: 149900,
  weightGrams: 700,
  dimensionsCm: null,
  pickupLocationId: 'loc-jaipur',
  ...over,
})

const order = (over: Partial<DraftOrder> = {}): DraftOrder => ({
  orderId: 'o1',
  orderNumber: 1042,
  customerName: 'Asha',
  city: 'Guwahati',
  pincode: '781001',
  line1: null,
  line2: null,
  stateCode: 'AS',
  phone: null,
  paymentStatus: 'paid',
  fulfillmentStatus: 'unfulfilled',
  paymentMode: 'prepaid',
  totalPaise: 149900,
  blocked: null,
  parcels: [parcel()],
  ...over,
})

const draft = (over: Partial<ShipmentDraft> = {}): ShipmentDraft => ({
  couriers: [
    { id: 'delhivery', label: 'Delhivery', hasRates: false, hasPickup: true },
    { id: 'shiprocket', label: 'Shiprocket', hasRates: true, hasPickup: true },
  ],
  boxes: [
    {
      id: 'mailer',
      name: 'Small mailer',
      lengthCm: 25,
      widthCm: 20,
      heightCm: 5,
      weightGrams: 80,
      isDefault: true,
      costPaise: 800,
    },
  ],
  defaultBoxId: 'mailer',
  pickupPlaces: [],
  orders: [order()],
  ...over,
})

describe('packageFor', () => {
  it("starts in the store's main box with the parcel's weight and pickup place", () => {
    const form = packageFor(order(), parcel(), draft())
    expect(form).toMatchObject({
      parcelId: 'p1',
      pickupLocationId: 'loc-jaipur',
      boxId: 'mailer',
      weightGrams: '700',
      length: '25',
      width: '20',
      height: '5',
      paymentMode: 'prepaid',
      codAmount: '',
    })
  })

  it("uses the products' own box when the parcel has one", () => {
    const form = packageFor(
      order(),
      parcel({ dimensionsCm: { length: 30, width: 30, height: 10 } }),
      draft(),
    )
    expect(form).toMatchObject({ boxId: PRODUCT_BOX, length: '30', height: '10' })
  })

  it('pre-fills the amount to collect for a cash on delivery order', () => {
    const form = packageFor(order({ paymentMode: 'cod' }), parcel(), draft())
    expect(form).toMatchObject({ paymentMode: 'cod', codAmount: '1499' })
  })

  it('falls back to a custom size when the store has no boxes', () => {
    const form = packageFor(order(), parcel(), draft({ boxes: [], defaultBoxId: null }))
    expect(form).toMatchObject({ boxId: CUSTOM_BOX, length: '' })
  })
})

describe('withBox and parsePackage', () => {
  const start = packageFor(order(), parcel(), draft())

  it('switching to custom keeps the typed size; a named box fills its own', () => {
    const custom = withBox({ ...start, length: '40' }, CUSTOM_BOX, parcel(), draft().boxes)
    expect(custom.length).toBe('40')
    expect(withBox(custom, 'mailer', parcel(), draft().boxes).length).toBe('25')
  })

  it('reads the form as numbers', () => {
    expect(parsePackage(start)).toEqual({
      weightGrams: 700,
      dimensionsCm: { length: 25, width: 20, height: 5 },
      paymentMode: 'prepaid',
      codAmountPaise: undefined,
    })
  })

  it('needs a weight, and an amount for cash on delivery', () => {
    expect(parsePackage({ ...start, weightGrams: '' })).toBeNull()
    expect(parsePackage({ ...start, weightGrams: '0' })).toBeNull()
    expect(parsePackage({ ...start, paymentMode: 'cod', codAmount: '' })).toBeNull()
    expect(parsePackage({ ...start, paymentMode: 'cod', codAmount: '1499.50' })).toMatchObject({
      codAmountPaise: 149950,
    })
  })

  it('a half-typed size sends no dimensions rather than a zero', () => {
    expect(parsePackage({ ...start, height: '' })?.dimensionsCm).toBeUndefined()
  })

  it("asks for rates from the picked place with the parcel's value", () => {
    const parsed = parsePackage(start)
    if (!parsed) throw new Error('expected a parsed package')
    expect(quoteRequest(order(), parcel(), { ...start, pickupLocationId: null }, parsed)).toEqual({
      orderId: 'o1',
      fulfillmentOrderId: 'p1',
      pickupLocationId: null,
      weightGrams: 700,
      dimensionsCm: { length: 25, width: 20, height: 5 },
      paymentMode: 'prepaid',
      declaredValuePaise: 149900,
    })
  })
})

describe('startingPick', () => {
  it('starts on the recommended courier', () => {
    const options = [
      row({ providerId: 'delhivery' }),
      row({ providerId: 'shiprocket', badges: ['cheapest', 'recommended'] }),
    ]
    expect(startingPick(options)).toBe('shiprocket')
  })

  it('skips couriers that cannot take it, and falls back to shipping it yourself', () => {
    expect(
      startingPick([
        row({ providerId: 'a', problem: 'not_serviceable' }),
        row({ providerId: 'b' }),
      ]),
    ).toBe('b')
    expect(startingPick([row({ providerId: 'a', problem: 'unreachable' })])).toBe(MANUAL)
    expect(startingPick([])).toBe(MANUAL)
  })

  it("starts on the courier app's own courier when it can take the parcel", () => {
    const options = [
      row({ providerId: 'delhivery', serviceId: 'surface', pricePaise: 9000 }),
      row({ providerId: 'delhivery', serviceId: 'air', pricePaise: 15000 }),
      row({ providerId: 'shiprocket', badges: ['recommended'] }),
    ]
    expect(startingPick(options, 'delhivery')).toBe('delhivery:surface')
    const cannot = [
      row({ providerId: 'delhivery', problem: 'not_serviceable' }),
      row({ providerId: 'shiprocket', badges: ['recommended'] }),
    ]
    expect(startingPick(cannot, 'delhivery')).toBe('shiprocket')
  })
})

describe('startingBulkPick', () => {
  const total = (providerId: string, canTake: number, recommended = false) => ({
    providerId,
    label: providerId,
    pricePaise: 0,
    unpriced: 0,
    canTake,
    recommended,
  })

  it("picks one courier for all with the courier app's courier", () => {
    const totals = [total('delhivery', 2), total('shiprocket', 3, true)]
    expect(startingBulkPick(totals, 'delhivery')).toEqual({ mode: 'one', providerId: 'delhivery' })
  })

  it('keeps the default mode on the recommended courier otherwise', () => {
    const totals = [total('delhivery', 0), total('shiprocket', 3, true)]
    expect(startingBulkPick(totals, 'delhivery')).toEqual({ mode: null, providerId: 'shiprocket' })
    expect(startingBulkPick(totals)).toEqual({ mode: null, providerId: 'shiprocket' })
  })
})

describe('bulk', () => {
  const quotes: ParcelQuote[] = [
    {
      orderId: 'o1',
      fulfillmentOrderId: 'p1',
      chargedWeightGrams: 500,
      originPincode: '302001',
      options: [
        row({ providerId: 'delhivery', minTransitDays: 2, badges: ['fastest'] }),
        row({ providerId: 'shiprocket', pricePaise: 6000, badges: ['cheapest', 'recommended'] }),
      ],
    },
    {
      orderId: 'o2',
      fulfillmentOrderId: 'p2',
      chargedWeightGrams: 500,
      originPincode: '302001',
      options: [
        row({ providerId: 'delhivery', problem: 'not_serviceable' }),
        row({
          providerId: 'shiprocket',
          pricePaise: 8000,
          minTransitDays: 4,
          badges: ['cheapest', 'fastest', 'recommended'],
        }),
      ],
    },
  ]

  it('leaves out blocked orders and orders that ship in several parcels', () => {
    const { ready, skipped } = bulkSplit([
      order(),
      order({ orderId: 'o2', blocked: 'no_address' }),
      order({ orderId: 'o3', parcels: [parcel(), parcel({ id: 'p2', position: 2 })] }),
    ])
    expect(ready.map((r) => r.order.orderId)).toEqual(['o1'])
    expect(skipped.map((s) => [s.order.orderId, s.reason])).toEqual([
      ['o2', 'no_address'],
      ['o3', 'several_parcels'],
    ])
  })

  it('totals each courier across the batch and recommends the one that takes the most', () => {
    const totals = courierTotals(quotes, draft().couriers)
    expect(totals).toEqual([
      {
        providerId: 'delhivery',
        label: 'Delhivery',
        pricePaise: 0,
        unpriced: 1,
        canTake: 1,
        recommended: false,
      },
      {
        providerId: 'shiprocket',
        label: 'Shiprocket',
        pricePaise: 14000,
        unpriced: 0,
        canTake: 2,
        recommended: true,
      },
    ])
  })

  it('one courier for all leaves out the orders it cannot take', () => {
    const picks = bulkPicks(quotes, 'one', 'delhivery')
    expect(picks.o1?.providerId).toBe('delhivery')
    expect(picks.o2).toBeNull()
    expect(bulkOrders(picks)).toEqual({
      orderIds: ['o1'],
      courierOverrides: { o1: 'delhivery' },
      serviceOverrides: {},
    })
  })

  it('a courier with several services counts and books its cheapest one per order', () => {
    const services: ParcelQuote[] = [
      {
        ...quotes[0],
        orderId: 'o1',
        options: [
          row({ providerId: 'delhivery', serviceId: 'E', pricePaise: 14000 }),
          row({ providerId: 'delhivery', serviceId: 'S', pricePaise: 9000 }),
        ],
      } as ParcelQuote,
    ]
    const picks = bulkPicks(services, 'one', 'delhivery')
    expect(picks.o1?.serviceId).toBe('S')
    expect(bulkOrders(picks).serviceOverrides).toEqual({ o1: 'S' })
    expect(
      courierTotals(services, [{ id: 'delhivery', label: 'Delhivery' }] as never)[0],
    ).toMatchObject({ pricePaise: 9000, canTake: 1 })
  })

  it('cheapest and fastest pick per order', () => {
    expect(bulkOrders(bulkPicks(quotes, 'cheapest', null)).courierOverrides).toEqual({
      o1: 'shiprocket',
      o2: 'shiprocket',
    })
    expect(bulkOrders(bulkPicks(quotes, 'fastest', null)).courierOverrides).toEqual({
      o1: 'delhivery',
      o2: 'shiprocket',
    })
  })
})
