import { describe, expect, it } from 'vitest'
import { bestByHandle, handleCandidates, slugify } from './slug'

describe('slugify', () => {
  it('keeps every ASCII word of a Shopify handle with a CJK character', () => {
    expect(slugify('talongames-幻-maboroshi-series-gaming-mousepad')).toBe(
      'talongames-maboroshi-series-gaming-mousepad',
    )
  })
})

describe('handleCandidates', () => {
  it('decodes a percent-encoded UTF-8 handle, then falls back to the ASCII slug', () => {
    const raw = encodeURIComponent('talongames-幻-maboroshi-series-gaming-mousepad')
    expect(handleCandidates(raw)).toEqual([
      'talongames-幻-maboroshi-series-gaming-mousepad',
      'talongames-maboroshi-series-gaming-mousepad',
    ])
  })

  it('tries the plain handle once', () => {
    expect(handleCandidates('blue-tee')).toEqual(['blue-tee'])
  })

  it('lower-cases a mixed-case link', () => {
    expect(handleCandidates('Blue-Tee')).toEqual(['Blue-Tee', 'blue-tee'])
  })

  it('leaves a malformed escape as it came', () => {
    expect(handleCandidates('tee-%E5%B9')).toEqual(['tee-%E5%B9', 'tee-%e5%b9', 'tee-e5-b9'])
  })
})

describe('bestByHandle', () => {
  it('prefers the exact handle over the ASCII fallback', () => {
    const rows = [{ handle: 'tee' }, { handle: 'Tee' }]
    expect(bestByHandle(rows, ['Tee', 'tee'], (r) => r.handle)).toEqual({ handle: 'Tee' })
    expect(bestByHandle([], ['tee'], (r: { handle: string }) => r.handle)).toBeNull()
  })
})
