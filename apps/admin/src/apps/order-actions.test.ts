import { describe, expect, it } from 'vitest'
import {
  actionLabel,
  actionsFor,
  linkPath,
  meets,
  type OrderAction,
  type OrderActionGroup,
  type OrderFacts,
  readyToShip,
  shipmentHref,
} from './order-actions'

const paidToPack: OrderFacts = {
  status: 'open',
  paymentStatus: 'paid',
  fulfillmentStatus: 'unfulfilled',
  paymentMethod: 'razorpay',
  isTest: false,
}

const queue: OrderAction = {
  id: 'add-to-queue',
  label: { en: 'Add to invoice queue', hi: 'इनवॉइस कतार में जोड़ें' },
  targets: ['detail', 'row', 'bulk'],
  handler: { type: 'procedure', procedure: 'gst-invoices/queue-add' },
  requires: ['not-test'],
}
const generate: OrderAction = {
  ...queue,
  id: 'generate-invoice',
  label: { en: 'Generate GST invoice' },
  targets: ['detail', 'row'],
  handler: { type: 'procedure', procedure: 'gst-invoices/generate' },
}
const ship: OrderAction = {
  id: 'ship-delhivery',
  label: { en: 'Create shipment' },
  targets: ['detail', 'row', 'bulk'],
  handler: { type: 'shipment', providerId: 'delhivery' },
  requires: ['open', 'unfulfilled', 'paid-or-cod'],
}

const groups: OrderActionGroup[] = [
  { appId: 'gst-invoices', appName: 'GST invoices', icon: 'FileText', actions: [generate, queue] },
  { appId: 'delhivery', appName: 'Delhivery', icon: 'Truck', actions: [ship] },
]
const all = () => true
const ids = (gs: OrderActionGroup[]) => gs.map((g) => [g.appId, g.actions.map((a) => a.id)])

describe('meets and readyToShip', () => {
  it('ready to ship: open, still to pack, and paid or cash on delivery', () => {
    expect(readyToShip(paidToPack)).toBe(true)
    expect(readyToShip({ ...paidToPack, paymentStatus: 'unpaid' })).toBe(false)
    expect(readyToShip({ ...paidToPack, paymentStatus: 'unpaid', paymentMethod: 'cod' })).toBe(true)
    expect(readyToShip({ ...paidToPack, fulfillmentStatus: 'partially_fulfilled' })).toBe(true)
    expect(readyToShip({ ...paidToPack, fulfillmentStatus: 'shipped' })).toBe(false)
    expect(readyToShip({ ...paidToPack, status: 'cancelled' })).toBe(false)
  })

  it('not-test hides test-mode orders', () => {
    expect(meets(paidToPack, 'not-test')).toBe(true)
    expect(meets({ ...paidToPack, isTest: true }, 'not-test')).toBe(false)
  })
})

describe('actionsFor', () => {
  it('keeps actions placed on the menu, grouped by app', () => {
    expect(ids(actionsFor(groups, 'detail', paidToPack, all))).toEqual([
      ['gst-invoices', ['generate-invoice', 'add-to-queue']],
      ['delhivery', ['ship-delhivery']],
    ])
    expect(ids(actionsFor(groups, 'bulk', null, all))).toEqual([
      ['gst-invoices', ['add-to-queue']],
      ['delhivery', ['ship-delhivery']],
    ])
  })

  it('hides actions whose conditions the order fails, and drops an app left with none', () => {
    const shipped = { ...paidToPack, fulfillmentStatus: 'shipped' }
    expect(ids(actionsFor(groups, 'row', shipped, all))).toEqual([
      ['gst-invoices', ['generate-invoice', 'add-to-queue']],
    ])
    const test = { ...paidToPack, isTest: true }
    expect(ids(actionsFor(groups, 'row', test, all))).toEqual([['delhivery', ['ship-delhivery']]])
  })

  it('the bulk bar skips conditions: the handler skips what it cannot do', () => {
    expect(ids(actionsFor(groups, 'bulk', null, all))[0]).toEqual([
      'gst-invoices',
      ['add-to-queue'],
    ])
  })

  it('drops actions the admin cannot run (an unregistered procedure)', () => {
    const onlyShipments = (a: OrderAction) => a.handler.type !== 'procedure'
    expect(ids(actionsFor(groups, 'detail', paidToPack, onlyShipments))).toEqual([
      ['delhivery', ['ship-delhivery']],
    ])
  })
})

describe('labels and links', () => {
  it('shows Hindi when the app has it, English otherwise', () => {
    expect(actionLabel(queue, 'hi')).toBe('इनवॉइस कतार में जोड़ें')
    expect(actionLabel(generate, 'hi')).toBe('Generate GST invoice')
    expect(actionLabel(queue, 'en')).toBe('Add to invoice queue')
  })

  it('fills order ids into a link path', () => {
    expect(linkPath('/apps/x/order/{orderId}', ['a1'])).toBe('/apps/x/order/a1')
    expect(linkPath('/apps/x/batch?ids={orderIds}', ['a1', 'b2'])).toBe('/apps/x/batch?ids=a1,b2')
  })

  it("opens the order's Create shipment page with the courier picked", () => {
    expect(shipmentHref('o1', 'delhivery')).toBe('/orders/o1/ship?courier=delhivery')
  })
})
