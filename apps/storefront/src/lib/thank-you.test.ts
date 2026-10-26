import { formatDeliveryRange } from '@commerce/shipping'
import { describe, expect, it } from 'vitest'
import {
  deliveryWindow,
  firstName,
  type ThankYouProgressInput,
  thankYouProgress,
} from './thank-you'

const placed: ThankYouProgressInput = {
  status: 'open',
  paymentStatus: 'paid',
  fulfillmentStatus: 'unfulfilled',
  shipmentStatus: null,
  deliveredAt: null,
}

describe('firstName', () => {
  it('greets by the first word of the name', () => {
    expect(firstName('Asha Verma')).toBe('Asha')
    expect(firstName('  Ravi  ')).toBe('Ravi')
  })

  it('is null without a name', () => {
    expect(firstName(null)).toBeNull()
    expect(firstName(undefined)).toBeNull()
    expect(firstName('   ')).toBeNull()
  })
})

describe('thankYouProgress', () => {
  it('starts at Confirmed for a new order, and a draft counts as open', () => {
    expect(thankYouProgress(placed)).toEqual({ reached: 0, end: null })
    expect(thankYouProgress({ ...placed, status: 'draft' })).toEqual({ reached: 0, end: null })
  })

  it('moves to Packed, Shipped and Delivered as the order does', () => {
    expect(thankYouProgress({ ...placed, fulfillmentStatus: 'fulfilled' }).reached).toBe(1)
    expect(thankYouProgress({ ...placed, shipmentStatus: 'in_transit' }).reached).toBe(2)
    expect(thankYouProgress({ ...placed, fulfillmentStatus: 'delivered' }).reached).toBe(3)
  })

  it('reads out for delivery as Shipped', () => {
    expect(thankYouProgress({ ...placed, shipmentStatus: 'out_for_delivery' }).reached).toBe(2)
  })

  it('gives the end state instead of a step once the order left the timeline', () => {
    expect(thankYouProgress({ ...placed, status: 'cancelled' })).toEqual({
      reached: null,
      end: 'cancelled',
    })
    expect(thankYouProgress({ ...placed, paymentStatus: 'refunded' }).end).toBe('refunded')
    expect(thankYouProgress({ ...placed, shipmentStatus: 'rto' }).end).toBe('returning')
  })
})

describe('deliveryWindow', () => {
  it('is null when no parcel has an estimate', () => {
    expect(deliveryWindow([])).toBeNull()
    expect(deliveryWindow([null, null])).toBeNull()
  })

  it('spans the earliest first day to the latest last day across parcels', () => {
    expect(
      deliveryWindow([
        { earliest: '2026-10-20', latest: '2026-10-22' },
        null,
        { earliest: '2026-10-18', latest: '2026-10-21' },
      ]),
    ).toBe(formatDeliveryRange('2026-10-18', '2026-10-22'))
  })
})
