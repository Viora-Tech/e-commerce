import { describe, expect, it } from 'vitest'
import { listCancelsShipment, nextOrderMove, orderUndos } from './order-next-move'

describe('orderUndos (one rule for the order page and the orders list)', () => {
  it('offers Mark as unfulfilled on a packed open order, Mark as not delivered once delivered', () => {
    expect(orderUndos({ status: 'open', fulfillmentStatus: 'fulfilled' })).toEqual({
      unfulfil: true,
      undeliver: false,
      restore: false,
    })
    expect(orderUndos({ status: 'open', fulfillmentStatus: 'delivered' }).undeliver).toBe(true)
    expect(orderUndos({ status: 'open', fulfillmentStatus: 'unfulfilled' }).unfulfil).toBe(false)
  })

  it('offers Mark as unfulfilled when items read packed though the order reads Unfulfilled (#1535)', () => {
    const o = { status: 'open', fulfillmentStatus: 'unfulfilled' }
    expect(orderUndos({ ...o, packedUnits: 1 }).unfulfil).toBe(true)
    expect(orderUndos({ ...o, packedUnits: 0 }).unfulfil).toBe(false)
    expect(orderUndos({ ...o, status: 'cancelled', packedUnits: 1 }).unfulfil).toBe(false)
  })

  it('offers Restore order only on a cancelled order, and nothing on imported history', () => {
    expect(orderUndos({ status: 'cancelled', fulfillmentStatus: 'unfulfilled' }).restore).toBe(true)
    expect(
      orderUndos({ status: 'cancelled', fulfillmentStatus: 'fulfilled', importedFrom: 'shopify' }),
    ).toEqual({ unfulfil: false, undeliver: false, restore: false })
  })
})

describe('nextOrderMove (the move both menus offer)', () => {
  it('a prepaid order: paid, then fulfilled, then delivered', () => {
    expect(nextOrderMove('open', 'unpaid', 'unfulfilled')).toBe('paid')
    expect(nextOrderMove('open', 'paid', 'unfulfilled')).toBe('fulfilled')
    expect(nextOrderMove('open', 'paid', 'partially_fulfilled')).toBe('fulfilled')
    expect(nextOrderMove('open', 'paid', 'fulfilled')).toBe('delivered')
    expect(nextOrderMove('open', 'paid', 'delivered')).toBeUndefined()
    expect(nextOrderMove('cancelled', 'paid', 'unfulfilled')).toBeUndefined()
  })

  it('cash on delivery is collected by the courier: pack and hand over first, then collect', () => {
    const cod = { cod: true }
    expect(nextOrderMove('open', 'unpaid', 'unfulfilled', cod)).toBe('fulfilled')
    expect(nextOrderMove('open', 'unpaid', 'fulfilled', cod)).toBe('delivered')
    expect(nextOrderMove('open', 'unpaid', 'shipped', cod)).toBe('delivered')
    expect(nextOrderMove('open', 'unpaid', 'delivered', cod)).toBe('paid')
  })

  it('a held order or a member who cannot pack is offered no packing move', () => {
    expect(nextOrderMove('open', 'paid', 'unfulfilled', { held: true })).toBeUndefined()
    expect(nextOrderMove('open', 'paid', 'fulfilled', { canPack: false })).toBeUndefined()
    // Mark as paid does not pack: still offered.
    expect(nextOrderMove('open', 'unpaid', 'unfulfilled', { held: true })).toBe('paid')
  })
})

describe('listCancelsShipment (the row menu offers what the order page offers)', () => {
  const booked = {
    status: 'open',
    fulfillmentStatus: 'fulfilled',
    deliveryStatus: 'created',
    labelLive: true,
  }
  it('offers Cancel shipment only for a live courier label', () => {
    expect(listCancelsShipment(booked)).toBe(true)
    expect(listCancelsShipment({ ...booked, fulfillmentStatus: 'partially_fulfilled' })).toBe(true)
  })
  it('never for a tracking number typed by hand, or no shipment at all', () => {
    expect(listCancelsShipment({ ...booked, labelLive: false })).toBe(false)
    expect(listCancelsShipment({ ...booked, deliveryStatus: null, labelLive: null })).toBe(false)
  })
  it('never once the booking ended or the order is not open', () => {
    expect(listCancelsShipment({ ...booked, deliveryStatus: 'cancelled' })).toBe(false)
    expect(listCancelsShipment({ ...booked, deliveryStatus: 'delivered' })).toBe(false)
    expect(listCancelsShipment({ ...booked, status: 'cancelled' })).toBe(false)
  })
})
