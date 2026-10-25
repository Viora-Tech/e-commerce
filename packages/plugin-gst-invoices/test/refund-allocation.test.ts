import { describe, expect, it } from 'vitest'
import { allocateRefund } from '../src/refund-allocation'

const t = (key: string, capacityPaise: number, weight = 0) => ({ key, capacityPaise, weight })
const asObject = (m: Map<string, number>) => Object.fromEntries(m)

describe('allocateRefund', () => {
  it('shares pro rata to what each invoice can still be credited', () => {
    expect(asObject(allocateRefund(16_000, [t('hr', 106_667), t('ka', 53_333)]))).toEqual({
      hr: 10_667,
      ka: 5_333,
    })
  })

  it('follows the returned value when the refund is for a return', () => {
    expect(
      asObject(allocateRefund(30_000, [t('hr', 100_000, 0), t('ka', 50_000, 50_000)])),
    ).toEqual({ hr: 0, ka: 30_000 })
  })

  it('passes what an invoice cannot take to the others', () => {
    expect(
      asObject(allocateRefund(60_000, [t('hr', 100_000, 0), t('ka', 53_333, 53_333)])),
    ).toEqual({ hr: 6_667, ka: 53_333 })
  })

  it('never credits more than all invoices can take, nor less than nothing', () => {
    expect(asObject(allocateRefund(500_000, [t('a', 100), t('b', 200)]))).toEqual({
      a: 100,
      b: 200,
    })
    expect(asObject(allocateRefund(-5, [t('a', 100)]))).toEqual({ a: 0 })
    expect(asObject(allocateRefund(50, [t('a', 0), t('b', -10)]))).toEqual({ a: 0, b: 0 })
  })

  it('adds back to the paisa', () => {
    const out = allocateRefund(10_001, [t('a', 9_999), t('b', 9_999), t('c', 9_999)])
    expect([...out.values()].reduce((n, x) => n + x, 0)).toBe(10_001)
  })
})
