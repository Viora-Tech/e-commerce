import { describe, expect, it } from 'vitest'
import {
  formatPresentmentCart,
  formatPresentmentLine,
  hasFixedPrice,
  lowestPresentment,
  type MarketPricing,
  type PresentmentLine,
  presentmentCartMinor,
  presentmentLineMinor,
} from '../src/index'

// ₹1,000 → $12.00; the catalog fixes v1 at $9.99.
const usd: MarketPricing = {
  currency: 'USD',
  rate: 0.012,
  adjustmentBp: 0,
  rounding: 'none',
  fixedMinor: { v1: 999 },
}
const fixedLine: PresentmentLine = {
  variantId: 'v1',
  unitPricePaise: 100_000,
  quantity: 2,
  linePaise: 200_000,
}
const convertedLine: PresentmentLine = {
  variantId: 'v2',
  unitPricePaise: 50_000,
  quantity: 3,
  linePaise: 150_000,
}
const lines = [fixedLine, convertedLine]
const subtotalPaise = 350_000

describe('cart lines in a market with catalog prices', () => {
  it('prices a fixed line as its unit price times the quantity', () => {
    expect(hasFixedPrice(usd, 'v1')).toBe(true)
    expect(hasFixedPrice(usd, 'v2')).toBe(false)
    expect(hasFixedPrice(null, 'v1')).toBe(false)
    expect(presentmentLineMinor(fixedLine, usd)).toBe(1998)
    expect(presentmentLineMinor(convertedLine, usd)).toBe(1800)
  })

  it('adds the lines up for the subtotal', () => {
    // $19.98 + $18.00, not ₹3,500 converted ($42.00).
    expect(presentmentCartMinor(subtotalPaise, lines, subtotalPaise, usd)).toBe(3798)
  })

  it('moves the total by as much as the subtotal moved, never below zero', () => {
    // ₹3,400 after a ₹100 discount is $40.80, less the $4.02 the fixed price took off.
    expect(presentmentCartMinor(340_000, lines, subtotalPaise, usd)).toBe(3678)
    expect(presentmentCartMinor(0, lines, subtotalPaise, usd)).toBe(0)
  })

  it('converts as before when no line has a fixed price', () => {
    expect(presentmentCartMinor(140_000, [convertedLine], 150_000, usd)).toBe(1680)
  })

  it('formats lines and cart amounts in the market currency, rupees without a market', () => {
    expect(formatPresentmentLine(fixedLine, usd)).toBe('$19.98')
    expect(formatPresentmentLine(convertedLine, usd)).toBe('$18')
    expect(formatPresentmentCart(subtotalPaise, lines, subtotalPaise, usd)).toBe('$37.98')
    expect(formatPresentmentLine(fixedLine, null)).toBe('₹2,000')
    expect(formatPresentmentCart(subtotalPaise, lines, subtotalPaise, null)).toBe('₹3,500')
  })
})

describe('lowestPresentment (a card’s "From" price)', () => {
  const variants = [
    { id: 'v1', pricePaise: 100_000 },
    { id: 'v2', pricePaise: 50_000 },
  ]

  it('picks the lowest price as the market shows it', () => {
    // v1 fixed at $9.99, v2 converts to $6.00.
    expect(lowestPresentment(variants, usd)).toEqual({ id: 'v2', pricePaise: 50_000, varies: true })
    // A fixed price below v2's converted one wins, though v1 costs more in rupees.
    const cheaper = { ...usd, fixedMinor: { v1: 500 } }
    expect(lowestPresentment(variants, cheaper)).toEqual({
      id: 'v1',
      pricePaise: 100_000,
      varies: true,
    })
  })

  it('compares rupees without a market', () => {
    expect(lowestPresentment(variants, null)).toEqual({
      id: 'v2',
      pricePaise: 50_000,
      varies: true,
    })
  })

  it('says when the variants read the same, and null without any', () => {
    const same = [
      { id: 'a', pricePaise: 1_000 },
      { id: 'b', pricePaise: 1_000 },
    ]
    expect(lowestPresentment(same, usd)?.varies).toBe(false)
    // A fixed price can make same rupee prices read differently.
    expect(lowestPresentment(same, { ...usd, fixedMinor: { a: 99 } })).toEqual({
      id: 'b',
      pricePaise: 1_000,
      varies: true,
    })
    expect(lowestPresentment([], usd)).toBeNull()
  })
})
