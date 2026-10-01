/** SOURCE OF TRUTH: store-scope tests — a variant image that is not this store's media is dropped, not written */
import { describe, expect, it } from 'vitest'
import { withKnownMedia } from './store-scope'

describe('withKnownMedia', () => {
  it("keeps this store's images and drops a foreign or stale one", () => {
    const variants = [{ sku: 'a', mediaId: 'mine' }, { sku: 'b', mediaId: 'foreign' }, { sku: 'c' }]
    expect(withKnownMedia(variants, new Set(['mine']))).toEqual([
      { sku: 'a', mediaId: 'mine' },
      { sku: 'b', mediaId: null },
      { sku: 'c' },
    ])
  })
})
