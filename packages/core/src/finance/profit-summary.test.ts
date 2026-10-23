/** SOURCE OF TRUTH: profit averages tests — WHAT: per order, per unit, basket size, verdict / WHY: guards the averages a seller prices on */
import { describe, expect, it } from 'vitest'
import { basketSizeOf, profitAverages, profitVerdict } from './profit-summary'

describe('profitAverages', () => {
  it('averages per order, per unit and by basket size, counting estimated orders', () => {
    const a = profitAverages([
      { profitPaise: 5_000, units: 1, estimated: false },
      { profitPaise: 7_000, units: 1, estimated: true },
      { profitPaise: 16_000, units: 2, estimated: false },
      { profitPaise: 30_000, units: 3, estimated: true },
      { profitPaise: -2_000, units: 0, estimated: false },
    ])
    expect(a).toMatchObject({
      orders: 5,
      estimatedOrders: 2,
      units: 7,
      profitPaise: 56_000,
      perOrderPaise: 11_200,
      perUnitPaise: 8_000,
    })
    expect(a.byBasket).toEqual([
      { size: '1', orders: 2, perOrderPaise: 6_000 },
      { size: '2', orders: 1, perOrderPaise: 16_000 },
      { size: '3+', orders: 1, perOrderPaise: 30_000 },
    ])
  })

  it('no orders: no averages', () => {
    const a = profitAverages([])
    expect(a.perOrderPaise).toBeNull()
    expect(a.perUnitPaise).toBeNull()
    expect(a.byBasket.every((b) => b.perOrderPaise === null)).toBe(true)
  })

  it('sizes baskets as 1, 2 and 3+', () => {
    expect([1, 2, 3, 9].map(basketSizeOf)).toEqual(['1', '2', '3+', '3+'])
  })
})

describe('profitVerdict', () => {
  it('profitable at zero or above', () => {
    expect(profitVerdict(0, 5_000)).toEqual({ kind: 'profitable' })
  })

  it('short: by how much, and about how many more orders at the average', () => {
    expect(profitVerdict(-12_000, 5_000)).toEqual({
      kind: 'short',
      shortPaise: 12_000,
      ordersNeeded: 3,
    })
    expect(profitVerdict(-12_000, -100)).toMatchObject({ ordersNeeded: null })
    expect(profitVerdict(-12_000, null)).toMatchObject({ ordersNeeded: null })
  })
})
