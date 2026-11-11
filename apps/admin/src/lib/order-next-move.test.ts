import { describe, expect, it } from 'vitest'
import { orderUndos } from './order-next-move'

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

  it('offers Restore order only on a cancelled order, and nothing on imported history', () => {
    expect(orderUndos({ status: 'cancelled', fulfillmentStatus: 'unfulfilled' }).restore).toBe(true)
    expect(
      orderUndos({ status: 'cancelled', fulfillmentStatus: 'fulfilled', importedFrom: 'shopify' }),
    ).toEqual({ unfulfil: false, undeliver: false, restore: false })
  })
})
