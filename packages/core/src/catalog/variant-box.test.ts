/** SOURCE OF TRUTH: variant box tests — WHAT: productBoxOf and settleBoxOwn / WHY: a variant's own box (#1517) must survive later product-level box changes */
import { describe, expect, it } from 'vitest'
import { productBoxOf, type SettleRow, settleBoxOwn, variantBox } from './variant-box'

const box = (id: string | null) => variantBox({ boxPresetId: id })
const row = (
  id: string,
  boxId: string | null,
  boxOwn: boolean | null,
  edited = false,
): SettleRow => ({
  id,
  ...box(boxId),
  boxOwn,
  edited,
})

describe('productBoxOf', () => {
  it('reads the first variant that follows the product', () => {
    const variants = [
      { ...box('big'), boxOwn: true },
      { ...box('small'), boxOwn: null },
      { ...box('small'), boxOwn: false },
    ]
    expect(productBoxOf(variants).boxPresetId).toBe('small')
  })

  it('falls back to the first variant when every variant has its own box', () => {
    expect(productBoxOf([{ ...box('a'), boxOwn: true }]).boxPresetId).toBe('a')
    expect(productBoxOf([])).toEqual(box(null))
  })
})

describe('settleBoxOwn: custom sizes', () => {
  it('treats a custom size as a different box from the store default', () => {
    const custom = {
      ...row('b', null, null, true),
      packageLengthCm: 10,
      packageWidthCm: 10,
      packageHeightCm: 5,
    }
    expect(settleBoxOwn([row('a', null, null), custom])).toEqual(new Map([['b', true]]))
  })
})

describe('settleBoxOwn', () => {
  it('marks an edited variant as its own when it differs from the product box', () => {
    const changes = settleBoxOwn([row('60', 'small', null), row('80', 'big', null, true)])
    expect(changes).toEqual(new Map([['80', true]]))
  })

  it('lets an edited variant follow the product again when it matches', () => {
    const changes = settleBoxOwn([row('60', 'small', false), row('80', 'small', true, true)])
    expect(changes).toEqual(new Map([['80', false]]))
  })

  it('uses the most common edited box when every follower was edited', () => {
    const changes = settleBoxOwn([
      row('a', 'small', null, true),
      row('b', 'small', null, true),
      row('c', 'big', null, true),
    ])
    expect(changes).toEqual(new Map([['c', true]]))
  })

  it('leaves variants that were not edited alone', () => {
    expect(settleBoxOwn([row('a', 'small', null), row('b', 'big', true)]).size).toBe(0)
  })
})
