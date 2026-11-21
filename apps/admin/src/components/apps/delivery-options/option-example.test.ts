/** SOURCE OF TRUTH: tests for ./option-example.ts — the checkout example line's prices. */
import { DeliveryOptionInputSchema } from '@commerce/core/delivery-options'
import { describe, expect, it } from 'vitest'
import { optionExample } from './option-example'

const option = (over: Record<string, unknown> = {}) =>
  DeliveryOptionInputSchema.parse({ name: 'Standard', ...over })

const list = (extra: string, price: Record<string, unknown> = {}, over = {}) =>
  option({
    price: { rounding: 'nine', ...price },
    couriers: { show: 'list', extra },
    ...over,
  })

const prices = (o: ReturnType<typeof option>) =>
  optionExample(o).cards.map((c) => [c.pricePaise, c.extraPaise])

describe('optionExample', () => {
  it('one card: courier cost rounded the option’s way', () => {
    expect(prices(option())).toEqual([[5000, null]])
    expect(prices(option({ price: { rounding: 'nine', markupPaise: 1000 } }))).toEqual([
      [5900, null],
    ])
    expect(prices(option({ speed: 'express', price: { rounding: 'off' } }))).toEqual([[7200, null]])
  })

  it('free and Shipping rates', () => {
    expect(prices(option({ price: { source: 'free', freeAbovePaise: 99_900 } }))).toEqual([
      [0, null],
    ])
    expect(
      optionExample(option({ price: { source: 'free', freeAbovePaise: 99_900 } })).freeAbovePaise,
    ).toBeNull()
    expect(prices(option({ price: { source: 'zone' } }))).toEqual([[null, null]])
  })

  it('price limits apply to the first card', () => {
    expect(prices(option({ price: { minPaise: 6900 } }))).toEqual([[6900, null]])
    expect(prices(option({ price: { maxPaise: 3900 } }))).toEqual([[3900, null]])
  })

  it('a list: the difference, the full price, or nothing extra', () => {
    expect(prices(list('difference'))).toEqual([
      [4900, null],
      [7800, 2900],
    ])
    expect(prices(list('full'))).toEqual([
      [4900, null],
      [7900, null],
    ])
    expect(prices(list('none'))).toEqual([
      [4900, null],
      [4900, null],
    ])
  })

  it('rounding applies to the full price as to the first', () => {
    expect(prices(list('full', { rounding: 'ten' }))).toEqual([
      [5000, null],
      [8000, null],
    ])
    expect(prices(list('full', { rounding: 'fifty' }))).toEqual([
      [4900, null],
      [9900, null],
    ])
  })

  it('a full price is never below a free first card or under a high minimum', () => {
    expect(prices(list('full', { source: 'free' }))).toEqual([
      [0, null],
      [7900, null],
    ])
    expect(prices(list('full', { minPaise: 9900 }))).toEqual([
      [9900, null],
      [9900, null],
    ])
  })

  it('Fastest first: the cheaper courier costs the same', () => {
    expect(prices(list('full', {}, { strategy: 'fastest' }))).toEqual([
      [7900, null],
      [7900, null],
    ])
  })
})
