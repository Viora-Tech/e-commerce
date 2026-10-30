import { describe, expect, it } from 'vitest'
import { breakdownLines } from '../src/services/sales-breakdown'

describe('sales breakdown (#100)', () => {
  it('nets discounts and returns, then adds shipping; GST is inside, not added', () => {
    const lines = breakdownLines({
      grossPaise: 100_000,
      discountsPaise: 10_000,
      returnsPaise: 5_000,
      shippingPaise: 2_000,
      taxPaise: 15_254,
    })
    const by = Object.fromEntries(lines.map((l) => [l.key, l.paise]))
    expect(by).toEqual({
      gross: 100_000,
      discounts: -10_000,
      returns: -5_000,
      net: 85_000,
      shipping: 2_000,
      tax: 15_254,
      total: 87_000,
    })
    expect(lines.filter((l) => l.subtotal).map((l) => l.key)).toEqual(['net', 'total'])
  })
})
