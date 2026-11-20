/** SOURCE OF TRUTH: the twin-collection check — WHAT: a collection named like a ruled one, whose
 * products the rule misses, is reported; one whose products the rule already covers is not /
 * WHY: owner, 20 Nov 2026: two "Glasspads" collections, a rule on only one. */
import { describe, expect, it } from 'vitest'
import { rule } from '../../testing/delivery-options-fixtures'
import { collectionTwins, twinKey } from './rule-checks'

const PADS = rule(
  'pads',
  { name: 'Pads', target: { kind: 'collections', values: ['c1'] }, routes: [{ carrier: 'delhivery' }] },
  0,
)
const collections = [
  { id: 'c1', title: 'Glasspads' },
  { id: 'c2', title: 'Glass pads' },
  { id: 'c3', title: 'Mice' },
]

describe('collections named like a ruled one', () => {
  it('reads "Glass pads" and "Glasspads" the same', () => {
    expect(twinKey('Glass pads')).toBe(twinKey('Glasspad'))
  })

  it('reports the twin and how many of its products the rule misses', () => {
    const members = new Map([
      ['c1', new Set(['a', 'b'])],
      ['c2', new Set(['b', 'c', 'd'])],
    ])
    const [twin, ...rest] = collectionTwins([PADS], collections, members)
    expect(rest).toEqual([])
    expect(twin?.other.id).toBe('c2')
    expect(twin?.missing).toBe(2)
  })

  it('stays quiet when the rule covers every product of the twin', () => {
    const members = new Map([
      ['c1', new Set(['a', 'b'])],
      ['c2', new Set(['b'])],
    ])
    expect(collectionTwins([PADS], collections, members)).toEqual([])
  })
})
