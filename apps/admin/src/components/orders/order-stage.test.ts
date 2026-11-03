import { describe, expect, it } from 'vitest'
import { orderRowDone } from './order-stage'

describe('orderRowDone', () => {
  it('dims rows with nothing left to pack, like Shopify', () => {
    const open = (fulfillmentStatus: Parameters<typeof orderRowDone>[0]['fulfillmentStatus']) =>
      orderRowDone({ status: 'open', fulfillmentStatus })
    expect(open('unfulfilled')).toBe(false)
    expect(open('partially_fulfilled')).toBe(false)
    expect(open('partially_delivered')).toBe(false)
    expect(open('fulfilled')).toBe(true)
    expect(open('shipped')).toBe(true)
    expect(orderRowDone({ status: 'completed', fulfillmentStatus: 'delivered' })).toBe(true)
    expect(orderRowDone({ status: 'cancelled', fulfillmentStatus: 'unfulfilled' })).toBe(true)
    expect(
      orderRowDone({ status: 'open', fulfillmentStatus: 'unfulfilled', archivedAt: '2026-11-01' }),
    ).toBe(true)
    expect(orderRowDone({ status: 'draft', fulfillmentStatus: 'unfulfilled' })).toBe(false)
  })
})
