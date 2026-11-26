import { ProgramRulesSchema } from '@commerce/plugin-affiliates/settings'
import { describe, expect, it } from 'vitest'
import { idsOf, patchRow, percentToBp, withPicked } from './targets'

/*
 * The product / collection pickers of an affiliate program save the same ids the old typed-id
 * inputs did: rates kept for rows still picked, other kinds untouched, and the result still
 * reads back through the program schema.
 */

const MAT = '11111111-1111-4111-8111-111111111111'
const PAD = '22222222-2222-4222-8222-222222222222'
const DESKS = '33333333-3333-4333-8333-333333333333'

type Override = {
  target: 'product' | 'collection'
  id: string
  label: string
  rule: { type: 'percent'; bp: number }
}

const rate = (target: Override['target'], id: string, bp: number): Override => ({
  target,
  id,
  label: '',
  rule: { type: 'percent', bp },
})

describe('affiliate program targets', () => {
  const saved = [rate('product', MAT, 1500), rate('collection', DESKS, 800)]

  it('a pick keeps rows still picked, adds new ones and drops the rest of that kind only', () => {
    const next = withPicked(saved, 'product', [PAD, MAT, PAD], (id) => rate('product', id, 1000))
    expect(next).toEqual([
      rate('collection', DESKS, 800),
      rate('product', PAD, 1000),
      rate('product', MAT, 1500),
    ])
    expect(withPicked(saved, 'product', [], (id) => rate('product', id, 1000))).toEqual([
      rate('collection', DESKS, 800),
    ])
    expect(idsOf(next, 'product')).toEqual([PAD, MAT])
    expect(idsOf(next, 'collection')).toEqual([DESKS])
  })

  it('a typed percent changes only its own row', () => {
    const next = patchRow(saved, 'product', MAT, {
      rule: { type: 'percent', bp: percentToBp('12.5') },
    })
    expect(next).toEqual([rate('product', MAT, 1250), rate('collection', DESKS, 800)])
  })

  it('percent text becomes basis points, clamped', () => {
    expect(percentToBp('10')).toBe(1000)
    expect(percentToBp('250')).toBe(10_000)
    expect(percentToBp('')).toBe(0)
    expect(percentToBp('', 1)).toBe(1)
    expect(percentToBp('abc', 1)).toBe(1)
  })

  it('picked rows are stored as the program schema reads them', () => {
    const overrides = withPicked([], 'collection', [DESKS], (id) => rate('collection', id, 900))
    const excludes = withPicked([], 'product', [PAD], (id) => ({
      target: 'product' as const,
      id,
      label: '',
    }))
    const targets = withPicked([], 'product', [MAT], (id) => ({
      target: 'product' as const,
      id,
      label: '',
      bp: 1500,
    }))
    const rules = ProgramRulesSchema.parse({
      overrides,
      excludes,
      coupon: { enabled: true, bp: 1000, appliesTo: 'products', targets },
    })
    expect(rules.overrides).toEqual(overrides)
    expect(rules.excludes).toEqual(excludes)
    expect(rules.coupon.targets).toEqual(targets)
  })
})
