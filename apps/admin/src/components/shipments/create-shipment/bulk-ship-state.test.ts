import type { CourierRateRow } from '@commerce/core'
import { describe, expect, it } from 'vitest'
import { editForm, formToEdit, repriced, withEditBox } from './bulk-edit-state'
import {
  bulkBookRequest,
  bulkLines,
  bulkSummary,
  isTicked,
  missingPackage,
  orderQuoteRequest,
  pickSource,
  pickupGroups,
  rulePick,
} from './bulk-ship-state'
import type { DraftOrder, DraftParcel, ParcelQuote, ShipmentDraft } from './flow-state'

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
  insurance: null,
  ...over,
})

const line = (weightGrams: number | null = 300) => ({
  id: 'l1',
  title: 'Glasspad',
  quantity: 1,
  imageUrl: null,
  sku: null,
  unitPricePaise: 249900,
  weightGrams,
})

const parcel = (over: Partial<DraftParcel> = {}): DraftParcel => ({
  id: 'p1',
  position: 1,
  locationName: null,
  lines: [line()],
  valuePaise: 249900,
  weightGrams: 820,
  dimensionsCm: { length: 48, width: 42, height: 4 },
  pickupLocationId: null,
  boxName: 'Glasspad box',
  ...over,
})

const order = (id: string, over: Partial<DraftOrder> = {}): DraftOrder => ({
  orderId: id,
  orderNumber: 1042,
  customerName: 'Riya Sharma',
  city: 'Bengaluru',
  pincode: '560038',
  line1: null,
  line2: null,
  stateCode: 'KA',
  phone: null,
  paymentStatus: 'paid',
  fulfillmentStatus: 'unfulfilled',
  paymentMode: 'prepaid',
  totalPaise: 249900,
  blocked: null,
  parcels: [parcel({ id: `p-${id}` })],
  unitsOrdered: 1,
  deliveryChoice: null,
  ...over,
})

const draft = (orders: DraftOrder[]): ShipmentDraft => ({
  couriers: [
    { id: 'delhivery', label: 'Delhivery', hasRates: true, hasPickup: true },
    { id: 'shiprocket', label: 'Shiprocket', hasRates: true, hasPickup: false },
  ],
  boxes: [
    {
      id: 'small',
      name: 'Small box',
      kind: 'box',
      lengthCm: 30,
      widthCm: 20,
      heightCm: 10,
      weightGrams: 150,
      isDefault: true,
      costPaise: null,
    },
  ],
  defaultBoxId: 'small',
  pickupPlaces: [],
  orders,
  insureByDefault: true,
})

const quote = (orderId: string, options: CourierRateRow[], over: Partial<ParcelQuote> = {}) =>
  ({
    orderId,
    fulfillmentOrderId: `p-${orderId}`,
    chargedWeightGrams: 2000,
    originPincode: '122001',
    options,
    checkout: null,
    ...over,
  }) as ParcelQuote

const OPTIONS = [
  row({ providerId: 'delhivery', pricePaise: 12550, badges: ['recommended'] }),
  row({ providerId: 'shiprocket', pricePaise: 11350, badges: ['cheapest'] }),
  row({ providerId: 'bluedart', pricePaise: 22750, badges: ['fastest'] }),
]

const linesFor = (
  orders: DraftOrder[],
  quotes: ParcelQuote[],
  over: Partial<Parameters<typeof bulkLines>[0]> = {},
) =>
  bulkLines({
    draft: draft(orders),
    quotes: Object.fromEntries(quotes.map((q) => [q.orderId, q])),
    asking: new Set(),
    edits: {},
    rule: 'recommended',
    providerId: null,
    insuredAll: false,
    ...over,
  })

describe('courier rule', () => {
  it('picks the row with the rule badge, else recommended, else the cheapest', () => {
    expect(rulePick(OPTIONS, null, 'recommended', null)?.providerId).toBe('delhivery')
    expect(rulePick(OPTIONS, null, 'cheapest', null)?.providerId).toBe('shiprocket')
    expect(rulePick(OPTIONS, null, 'fastest', null)?.providerId).toBe('bluedart')
    const plain = OPTIONS.map((o) => ({ ...o, badges: [] }))
    expect(rulePick(plain, null, 'fastest', null)?.providerId).toBe('shiprocket')
  })

  it('one courier for all takes that courier or nothing', () => {
    expect(rulePick(OPTIONS, null, 'one', 'bluedart')?.providerId).toBe('bluedart')
    expect(rulePick(OPTIONS, null, 'one', 'ekart')).toBeNull()
  })

  it("books the shopper's route whatever the rule", () => {
    const rows = [
      ...OPTIONS.slice(0, 2),
      { ...OPTIONS[2], chosenAtCheckout: true } as CourierRateRow,
    ]
    const checkout = { carrier: 'Blue Dart', serviceLabel: 'Apex' } as ParcelQuote['checkout']
    expect(rulePick(rows, checkout, 'cheapest', null)?.providerId).toBe('bluedart')
  })
})

describe('problem detection', () => {
  it('a product with no weight needs a package until one is typed', () => {
    const p = parcel({ lines: [line(null)], dimensionsCm: null, boxName: null })
    expect(missingPackage(p, undefined)).toEqual({ box: true })
    expect(missingPackage(parcel({ lines: [line(null)] }), undefined)).toEqual({ box: false })
    expect(missingPackage(p, { weightGrams: 800 })).toBeNull()
    expect(missingPackage(parcel(), undefined)).toBeNull()
  })

  it('keeps problem rows in the table, unticked', () => {
    const orders = [
      order('a'),
      order('b', { paymentMode: 'cod' }),
      order('c', { parcels: [parcel({ lines: [line(null)] })] }),
      order('d', { blocked: 'on_hold' }),
      order('e', { parcels: [parcel(), parcel({ id: 'p2' })] }),
      order('f'),
    ]
    const lines = linesFor(orders, [
      quote('a', OPTIONS),
      quote('b', [row({ providerId: 'delhivery', problem: 'no_cod' })]),
      quote('f', [row({ providerId: 'ekart', problem: 'not_serviceable' })]),
    ])
    expect(lines.map((l) => l.problem?.kind ?? l.status)).toEqual([
      'ready',
      'no_cod',
      'needs_package',
      'blocked',
      'blocked',
      'no_courier',
    ])
    expect(lines.filter((l) => isTicked(l, new Set())).map((l) => l.order.orderId)).toEqual(['a'])
  })

  it('a route the shopper paid for that cannot book needs a decision', () => {
    const q = quote('a', OPTIONS, {
      checkout: { carrier: 'Ekart', serviceLabel: 'Standard' } as ParcelQuote['checkout'],
    })
    const [l] = linesFor([order('a')], [q])
    expect(l?.problem).toEqual({ kind: 'checkout_route', route: 'Ekart Standard' })
  })

  it('an order still being asked is checking, not a problem', () => {
    const [l] = linesFor([order('a')], [], { asking: new Set(['a']) })
    expect(l?.status).toBe('checking')
  })

  it("one courier for all says when that courier can't take an order", () => {
    const [l] = linesFor([order('a')], [quote('a', OPTIONS)], { rule: 'one', providerId: 'x' })
    expect(l?.problem).toEqual({ kind: 'not_this_courier' })
  })
})

describe('hand picks and insurance', () => {
  it('a courier picked in the popup beats the rule', () => {
    const [l] = linesFor([order('a')], [quote('a', OPTIONS)], {
      edits: { a: { optionKey: 'bluedart' } },
    })
    expect(l?.pick?.providerId).toBe('bluedart')
    expect(l && pickSource(l, 'recommended')).toBe('hand')
  })

  it('insurance follows the batch switch, the popup, or the shopper having paid for it', () => {
    const insuredRow = row({
      providerId: 'delhivery',
      pricePaise: 10000,
      badges: ['recommended'],
      insurance: {
        source: 'protect',
        feePaise: 2000,
        gstPaise: 360,
        pricePaise: 2360,
        gstIncluded: false,
        estimate: false,
        protectCategory: null,
        protectBps: null,
        rateBps: null,
      },
    })
    const q = [quote('a', [insuredRow])]
    expect(linesFor([order('a')], q, { insuredAll: true })[0]?.pick?.pricePaise).toBe(12360)
    expect(linesFor([order('a')], q)[0]?.pick?.pricePaise).toBe(10000)
    expect(
      linesFor([order('a')], q, { insuredAll: true, edits: { a: { insured: false } } })[0]?.pick
        ?.pricePaise,
    ).toBe(10000)
    const paid = order('a', {
      deliveryChoice: {
        name: 'Express',
        pricePaise: 9900,
        route: null,
        providerId: null,
        insured: true,
      },
    })
    expect(linesFor([paid], q)[0]?.insured).toBe(true)
  })
})

describe('totals and booking', () => {
  const orders = [order('a'), order('b'), order('c', { paymentMode: 'cod' })]
  const quotes = [
    quote('a', OPTIONS),
    quote('b', [row({ providerId: 'shiprocket', pricePaise: null, badges: ['recommended'] })]),
    quote('c', [row({ providerId: 'delhivery', problem: 'no_cod' })]),
  ]

  it('counts ready, need attention and the total of the ticked rows', () => {
    const lines = linesFor(orders, quotes)
    expect(bulkSummary(lines, new Set())).toEqual({
      ready: 2,
      total: 3,
      attention: 1,
      totalPaise: 12550,
      unpriced: 1,
      byProvider: { delhivery: 12550 },
    })
    expect(bulkSummary(lines, new Set(['a'])).ready).toBe(1)
  })

  it('books only the ticked ready rows, each with its own package, payment and insurance', () => {
    const edits = { a: { weightGrams: 950, paymentMode: 'cod' as const } }
    const lines = linesFor(orders, quotes, { edits })
    expect(bulkBookRequest(lines, new Set(['b']), edits)).toEqual({
      orderIds: ['a'],
      courierOverrides: { a: 'delhivery' },
      parcelIds: { a: 'p-a' },
      perOrder: { a: { insured: false, weightGrams: 950, paymentMode: 'cod' } },
    })
  })

  it('groups booked parcels by courier for one pickup each', () => {
    const lines = linesFor([order('a'), order('b')], [quote('a', OPTIONS), quote('b', OPTIONS)])
    const groups = pickupGroups(
      [
        { orderId: 'a', ok: true, shipmentId: 's1' },
        { orderId: 'b', ok: true, shipmentId: 's2' },
      ],
      lines,
      draft([]).couriers,
    )
    expect(groups).toEqual([
      {
        providerId: 'delhivery',
        label: 'Delhivery',
        shipmentIds: ['s1', 's2'],
        grams: 4000,
        canPickup: true,
      },
    ])
  })
})

describe('quote request and edit popup', () => {
  it("asks with the popup's package and payment over the order's own", () => {
    const o = order('a')
    const p = o.parcels[0] as DraftParcel
    expect(orderQuoteRequest(o, p)).toMatchObject({
      weightGrams: 820,
      dimensionsCm: { length: 48, width: 42, height: 4 },
      paymentMode: 'prepaid',
    })
    expect(
      orderQuoteRequest(o, p, {
        weightGrams: 950,
        dimensionsCm: { length: 30, width: 20, height: 10 },
        paymentMode: 'cod',
      }),
    ).toMatchObject({
      weightGrams: 950,
      dimensionsCm: { length: 30, width: 20, height: 10 },
      paymentMode: 'cod',
    })
  })

  it('an untouched popup saves no package change; a new box and weight do', () => {
    const d = draft([order('a')])
    const [l] = linesFor(d.orders, [quote('a', OPTIONS)])
    if (!l) throw new Error('no line')
    const form = editForm(l, undefined, d.boxes)
    expect(form).toMatchObject({ boxId: 'own', weight: '820', length: '48' })
    const untouched = formToEdit(form, l)
    expect(untouched).toEqual({ insured: false })
    expect(repriced(undefined, untouched)).toBe(false)
    const boxed = formToEdit({ ...withEditBox(form, 'small', l, d.boxes), weight: '950' }, l)
    expect(boxed).toEqual({
      insured: false,
      weightGrams: 950,
      dimensionsCm: { length: 30, width: 20, height: 10 },
      boxId: 'small',
    })
    expect(repriced(undefined, boxed)).toBe(true)
  })

  it('a weight typed for a product with none is saved even when it matches the guess', () => {
    const o = order('a', { parcels: [parcel({ id: 'p-a', lines: [line(null)] })] })
    const [l] = linesFor([o], [])
    if (!l) throw new Error('no line')
    const form = editForm(l, undefined, [])
    expect(form.weight).toBe('')
    expect(formToEdit({ ...form, weight: '820' }, l).weightGrams).toBe(820)
  })
})
