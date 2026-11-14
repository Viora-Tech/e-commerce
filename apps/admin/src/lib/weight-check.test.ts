/** SOURCE OF TRUTH: suspect parcel weights — WHAT: items and parcels over 30 kg are flagged / WHY: a mousepad saved as 10,00,000 g made couriers quote 1,000 kg (owner, 14 Nov 2026) */
import { describe, expect, it } from 'vitest'
import { suspectWeights } from './weight-check'

describe('suspectWeights', () => {
  it('flags an item saved in the wrong unit', () => {
    expect(
      suspectWeights(
        [{ title: 'INFP Little Butterfly Mousepad', weightGrams: 1_000_000 }],
        1_000_050,
      ),
    ).toEqual({
      items: [{ title: 'INFP Little Butterfly Mousepad', grams: 1_000_000 }],
      parcel: true,
    })
  })

  it('says nothing for normal gear, a heavy glasspad included', () => {
    expect(
      suspectWeights(
        [
          { title: 'Mousepad', weightGrams: 1000 },
          { title: 'Glasspad', weightGrams: 6000 },
          { title: 'No weight', weightGrams: null },
        ],
        7600,
      ),
    ).toBeNull()
  })

  it('flags a parcel typed too heavy even when every item is fine', () => {
    expect(suspectWeights([{ title: 'Mouse', weightGrams: 400 }], 400_000)).toEqual({
      items: [],
      parcel: true,
    })
  })
})
