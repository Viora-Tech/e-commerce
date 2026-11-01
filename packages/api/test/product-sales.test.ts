/** SOURCE OF TRUTH: product page "Sales past 90 days" maths (#56): units, buyers, net of discount and refund shares */
import { describe, expect, it } from 'vitest'
import { type ProductSaleLine, summariseProductSales } from '../src/services/product-sales'

const line = (patch: Partial<ProductSaleLine>): ProductSaleLine => ({
  orderId: 'o1',
  buyerKey: 'c1',
  quantity: 1,
  unitPricePaise: 100_00,
  orderSubtotalPaise: 100_00,
  orderDiscountPaise: 0,
  ...patch,
})

describe('summariseProductSales', () => {
  it('is all zeros with no sales', () => {
    expect(summariseProductSales([], new Map())).toEqual({
      units: 0,
      orders: 0,
      buyers: 0,
      grossPaise: 0,
      netPaise: 0,
    })
  })

  it('counts units, orders and distinct buyers', () => {
    const sales = summariseProductSales(
      [
        line({ orderId: 'o1', buyerKey: 'c1', quantity: 2, orderSubtotalPaise: 200_00 }),
        line({ orderId: 'o2', buyerKey: 'c1' }),
        line({ orderId: 'o3', buyerKey: 'c2', quantity: 3, orderSubtotalPaise: 300_00 }),
      ],
      new Map(),
    )
    expect(sales).toMatchObject({ units: 6, orders: 3, buyers: 2, grossPaise: 600_00 })
    expect(sales.netPaise).toBe(600_00)
  })

  it('takes only the product’s share of a mixed cart’s discount and refund', () => {
    const sales = summariseProductSales(
      [line({ orderSubtotalPaise: 400_00, orderDiscountPaise: 40_00 })],
      new Map([['o1', 80_00]]),
    )
    // A quarter of the cart: 10 of the discount, 20 of the refund.
    expect(sales.netPaise).toBe(70_00)
  })

  it('never takes a line below zero', () => {
    const sales = summariseProductSales(
      [line({ orderDiscountPaise: 50_00 })],
      new Map([['o1', 500_00]]),
    )
    expect(sales.netPaise).toBe(0)
  })
})
