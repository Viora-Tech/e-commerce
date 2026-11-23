/** Pure: no database. Which documents a cancel + full refund may cancel, and how they are named. */
import { describe, expect, it } from 'vitest'
import { docLabel, voidable } from '../src/void-unshipped'

describe('voidUnshippedSale never touches an invoice recorded outside', () => {
  it('leaves external (Already invoiced) documents out', () => {
    const docs = [
      { id: 'a', source: 'koomerce', number: 'INV-1' },
      { id: 'b', source: 'external', number: 'TALLY-9' },
    ]
    expect(voidable(docs).map((d) => d.id)).toEqual(['a'])
  })

  it('names a document by its number, never its id', () => {
    expect(docLabel({ number: 'INV-1', source: 'koomerce' })).toBe('INV-1')
    expect(docLabel({ number: null, source: 'external' })).toBe('an invoice recorded outside')
    expect(docLabel({ number: null, source: 'koomerce' })).toBe('an unnumbered invoice')
  })
})
