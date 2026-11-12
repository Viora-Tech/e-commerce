import type { RowCover } from '@commerce/core'
import { describe, expect, it } from 'vitest'
import { coverNotes } from './cover-notes'

const SHIPROCKET: RowCover = {
  valuePaise: 1_349_900,
  coverCapPaise: 47_500_000,
  uninsuredLimitPaise: 250_000,
  coversFragile: true,
  excludesUsed: true,
  deductibleBps: 50,
  hasUsedItems: false,
}

describe('the drawer’s cover notes', () => {
  it('Delhivery on a ₹40,000 parcel covers ₹30,000 of it', () => {
    const delhivery = { ...SHIPROCKET, valuePaise: 4_000_000, coverCapPaise: 3_000_000 }
    expect(coverNotes({ cover: delhivery }, true, 0)).toMatchObject({
      coveredPaise: 3_000_000,
      valuePaise: 4_000_000,
      capped: true,
    })
  })

  it('insurance off on a ₹13,499 Shiprocket parcel: at most ₹2,500 if lost', () => {
    expect(coverNotes({ cover: SHIPROCKET }, false, 0).uninsuredLimitPaise).toBe(250_000)
    // Insured, or a parcel worth less than the limit: no warning.
    expect(coverNotes({ cover: SHIPROCKET }, true, 0).uninsuredLimitPaise).toBeNull()
    const small = { ...SHIPROCKET, valuePaise: 200_000 }
    expect(coverNotes({ cover: small }, false, 0).uninsuredLimitPaise).toBeNull()
  })

  it('insured with an open-box product: Shiprocket does not cover it', () => {
    const used = { ...SHIPROCKET, hasUsedItems: true }
    expect(coverNotes({ cover: used }, true, 0).usedNotCovered).toBe(true)
    expect(coverNotes({ cover: used }, false, 0).usedNotCovered).toBe(false)
    expect(coverNotes({ cover: { ...used, excludesUsed: null } }, true, 0).usedNotCovered).toBe(
      false,
    )
  })

  it('carries the claim excess for the tooltip, and the value when nothing is known', () => {
    expect(coverNotes({ cover: SHIPROCKET }, true, 0).deductibleBps).toBe(50)
    expect(coverNotes(null, true, 99_900)).toMatchObject({ coveredPaise: 99_900, capped: false })
  })
})
