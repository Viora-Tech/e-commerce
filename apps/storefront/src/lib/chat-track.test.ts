import { describe, expect, it } from 'vitest'
import {
  type ChatOrderProgressInput,
  chatOrderProgress,
  chatPaidBy,
  chatVariantName,
} from './chat-track'

const placed: ChatOrderProgressInput = {
  status: 'open',
  paymentStatus: 'paid',
  fulfillmentStatus: 'unfulfilled',
  shipmentStatus: null,
  deliveredAt: null,
}

const states = (o: Partial<ChatOrderProgressInput>) =>
  chatOrderProgress({ ...placed, ...o }).steps?.map((s) => s.state)

describe('chatOrderProgress', () => {
  it('a new order is confirmed, the rest still to come', () => {
    expect(chatOrderProgress(placed).status).toBe('confirmed')
    expect(states({})).toEqual(['current', 'todo', 'todo', 'todo', 'todo'])
  })

  it('a packed order or a booked shipment reads as packed', () => {
    expect(chatOrderProgress({ ...placed, fulfillmentStatus: 'fulfilled' }).status).toBe('packed')
    expect(states({ shipmentStatus: 'created' })).toEqual([
      'done',
      'current',
      'todo',
      'todo',
      'todo',
    ])
  })

  it('a parcel with the courier is shipped, then out for delivery', () => {
    expect(chatOrderProgress({ ...placed, shipmentStatus: 'in_transit' }).status).toBe('shipped')
    expect(chatOrderProgress({ ...placed, shipmentStatus: 'picked_up' }).status).toBe('shipped')
    expect(chatOrderProgress({ ...placed, fulfillmentStatus: 'shipped' }).status).toBe('shipped')
    expect(states({ shipmentStatus: 'out_for_delivery' })).toEqual([
      'done',
      'done',
      'done',
      'current',
      'todo',
    ])
  })

  it('delivered by the courier, by hand or on a completed order', () => {
    const all = ['done', 'done', 'done', 'done', 'current']
    expect(states({ shipmentStatus: 'delivered' })).toEqual(all)
    expect(states({ deliveredAt: '2026-10-24T10:00:00Z' })).toEqual(all)
    expect(states({ status: 'completed' })).toEqual(all)
    expect(states({ fulfillmentStatus: 'partially_delivered' })).toEqual(all)
  })

  it('cancelled, refunded and returning orders drop the timeline', () => {
    expect(chatOrderProgress({ ...placed, status: 'cancelled' })).toEqual({
      status: 'cancelled',
      steps: null,
    })
    expect(chatOrderProgress({ ...placed, paymentStatus: 'refunded' }).status).toBe('refunded')
    expect(chatOrderProgress({ ...placed, shipmentStatus: 'rto' }).status).toBe('returning')
    expect(chatOrderProgress({ ...placed, fulfillmentStatus: 'returned' }).status).toBe('returning')
  })

  it('a part refund keeps the timeline', () => {
    expect(chatOrderProgress({ ...placed, paymentStatus: 'partially_refunded' }).status).toBe(
      'confirmed',
    )
  })
})

describe('chatPaidBy', () => {
  it('names the method only on a paid order', () => {
    expect(chatPaidBy('paid', 'upi')).toBe('upi')
    expect(chatPaidBy('paid', 'cardless_emi')).toBe('emi')
    expect(chatPaidBy('pending', 'upi')).toBeNull()
    expect(chatPaidBy('paid', 'other')).toBeNull()
    expect(chatPaidBy('paid', null)).toBeNull()
  })
})

describe('chatVariantName', () => {
  it('drops the placeholder variant', () => {
    expect(chatVariantName('M')).toBe('M')
    expect(chatVariantName('Default Title')).toBeNull()
    expect(chatVariantName(null)).toBeNull()
  })
})
