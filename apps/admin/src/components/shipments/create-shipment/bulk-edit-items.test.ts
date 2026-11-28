import type { CourierRateRow } from '@commerce/core'
import { describe, expect, it } from 'vitest'
import {
  canApply,
  clampCount,
  editForm,
  formParcel,
  formToEdit,
  pickedUnits,
  repriced,
  withCount,
} from './bulk-edit-state'
import { bulkBookRequest, bulkLines, type OrderEdit } from './bulk-ship-state'
import type { DraftOrder, DraftParcel, ParcelQuote, ShipmentDraft } from './flow-state'
import { bulkEditAsk } from './use-bulk-edit-quote'

/** Edit shipment's Items to send: pick which items (and how many) of the parcel go now. */

const item = (id: string, title: string, quantity: number, grams: number, pricePaise: number) => ({
  id,
  title,
  quantity,
  imageUrl: null,
  sku: null,
  unitPricePaise: pricePaise,
  weightGrams: grams,
  availability: { inStock: quantity, preorder: null, restockOn: null },
})

// 2 glasspads (300 g, ₹2,499) and a wrist rest (200 g, ₹999), in a 150 g box: 950 g, ₹5,997.
const parcel: DraftParcel = {
  id: 'p-a',
  position: 1,
  locationName: null,
  lines: [item('l1', 'Glasspad', 2, 300, 249900), item('l2', 'Wrist rest', 1, 200, 99900)],
  valuePaise: 599700,
  weightGrams: 950,
  dimensionsCm: { length: 48, width: 42, height: 4 },
  pickupLocationId: null,
  boxName: 'Glasspad box',
}

const order = (over: Partial<DraftOrder> = {}): DraftOrder => ({
  orderId: 'a',
  orderNumber: 1042,
  customerName: 'Riya Sharma',
  city: 'Bengaluru',
  pincode: '560038',
  line1: null,
  line2: null,
  stateCode: 'KA',
  phone: null,
  paymentStatus: 'pending',
  fulfillmentStatus: 'unfulfilled',
  paymentMode: 'cod',
  totalPaise: 599700,
  blocked: null,
  parcels: [parcel],
  unitsOrdered: 3,
  deliveryChoice: null,
  payOnlineRequestedAt: null,
  ...over,
})

const draft = (o: DraftOrder): ShipmentDraft => ({
  couriers: [{ id: 'delhivery', label: 'Delhivery', hasRates: true, hasPickup: true }],
  boxes: [],
  defaultBoxId: null,
  pickupPlaces: [],
  orders: [o],
  insureByDefault: false,
})

const row = {
  optionKey: 'delhivery',
  providerId: 'delhivery',
  providerName: 'delhivery',
  providerLabel: 'Delhivery',
  serviceId: null,
  charges: [],
  chargeableWeightGrams: null,
  pricePaise: 9000,
  minTransitDays: null,
  maxTransitDays: null,
  codAvailable: true,
  problem: null,
  problemDetail: null,
  deliveryBy: null,
  etaFromSettings: false,
  badges: ['recommended'],
  insurance: null,
} as CourierRateRow

const quote = {
  orderId: 'a',
  fulfillmentOrderId: 'p-a',
  chargedWeightGrams: 950,
  originPincode: '131028',
  options: [row],
  checkout: null,
} as unknown as ParcelQuote

const lineWith = (edits: Record<string, OrderEdit> = {}, o = order()) => {
  const [l] = bulkLines({
    draft: draft(o),
    quotes: { a: quote },
    asking: new Set(),
    edits,
    rule: 'recommended',
    providerId: null,
    insuredAll: false,
  })
  if (!l) throw new Error('no line')
  return { line: l, edits }
}

describe('items to send: selection', () => {
  it('starts with every unit still to send, and clamps a count to it', () => {
    const { line } = lineWith()
    const form = editForm(line, undefined, [])
    expect(form.counts).toEqual({ l1: 2, l2: 1 })
    expect(clampCount(5, 2)).toBe(2)
    expect(clampCount(-1, 2)).toBe(0)
    expect(withCount(form, line, 'l1', 9).counts.l1).toBe(2)
    expect(withCount(form, line, 'l2', -3).counts.l2).toBe(0)
    expect(pickedUnits(withCount(form, line, 'l1', 1))).toBe(2)
  })

  it('blocks Apply (and asks no courier) with nothing ticked', () => {
    const { line } = lineWith()
    const none = withCount(withCount(editForm(line, undefined, []), line, 'l1', 0), line, 'l2', 0)
    expect(pickedUnits(none)).toBe(0)
    expect(canApply(none)).toBe(false)
    expect(bulkEditAsk(line, none, undefined)).toEqual({ state: 'same' })
    expect(canApply(editForm(line, undefined, []))).toBe(true)
  })

  it('every unit ticked again saves no split', () => {
    const { line } = lineWith()
    const form = editForm(line, undefined, [])
    const back = withCount(withCount(form, line, 'l2', 0), line, 'l2', 1)
    expect(formToEdit(back, line).keep).toBeUndefined()
  })
})

describe('items to send: weight and value follow', () => {
  it('drops the unticked items’ weight, as the order page’s partial shipment does', () => {
    const { line } = lineWith()
    const form = editForm(line, undefined, [])
    expect(form.weight).toBe('950')
    const noRest = withCount(form, line, 'l2', 0)
    expect(noRest.weight).toBe('750')
    const oneLess = withCount(noRest, line, 'l1', 1)
    expect(oneLess.weight).toBe('450')
    // The box stays as it was: only weight and value follow the picks.
    expect([oneLess.length, oneLess.width, oneLess.height]).toEqual(['48', '42', '4'])
    expect(formParcel(line, oneLess)?.valuePaise).toBe(249900)
  })

  it('asks the couriers again with the lighter, cheaper part', () => {
    const { line } = lineWith()
    const form = withCount(editForm(line, undefined, []), line, 'l2', 0)
    const ask = bulkEditAsk(line, form, undefined)
    expect(ask.state).toBe('ready')
    if (ask.state !== 'ready') return
    expect(JSON.parse(ask.key)).toMatchObject({ weightGrams: 750, declaredValuePaise: 499800 })
    expect(repriced(undefined, ask.edit)).toBe(true)
  })
})

describe('items to send: booking', () => {
  it('books only the picked lines and quantities, collecting their share on COD', () => {
    const first = lineWith()
    const form = withCount(
      withCount(editForm(first.line, undefined, []), first.line, 'l2', 0),
      first.line,
      'l1',
      1,
    )
    const edit = formToEdit(form, first.line)
    expect(edit.keep).toEqual({ l1: 1, l2: 0 })
    const { line, edits } = lineWith({ a: edit })
    // The row shows "Ships 1 of 3 items".
    expect(line.parcel?.lines.reduce((n, l) => n + l.quantity, 0)).toBe(1)
    expect(line.whole?.lines).toHaveLength(2)
    const request = bulkBookRequest([line], new Set(), edits)
    expect(request.parcelIds).toEqual({ a: 'p-a' })
    expect(request.perOrder.a).toMatchObject({
      weightGrams: 450,
      keep: [
        { orderLineId: 'l1', quantity: 1 },
        { orderLineId: 'l2', quantity: 0 },
      ],
      splitReason: 'not_ready',
      notifyCustomer: true,
      codAmountPaise: 249900,
    })
  })

  it('a prepaid part sends no COD amount; an untouched order sends no split', () => {
    const prepaid = order({ paymentMode: 'prepaid' })
    const first = lineWith({}, prepaid)
    const edit = formToEdit(
      withCount(editForm(first.line, undefined, []), first.line, 'l2', 0),
      first.line,
    )
    const { line, edits } = lineWith({ a: edit }, prepaid)
    const part = bulkBookRequest([line], new Set(), edits).perOrder.a
    expect(part?.keep).toHaveLength(2)
    expect(part?.codAmountPaise).toBeUndefined()
    const whole = lineWith()
    expect(bulkBookRequest([whole.line], new Set(), {}).perOrder.a?.keep).toBeUndefined()
  })
})
