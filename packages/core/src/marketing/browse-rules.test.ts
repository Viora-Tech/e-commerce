/** SOURCE OF TRUTH: browse abandonment rule tests — WHAT: product page detection, run keys and the due window / WHY: the beacon and both sweeps rely on them (audit #183) */
import { describe, expect, it } from 'vitest'
import {
  browseKey,
  browseKeyPrefix,
  browseRepeatSince,
  browseWindow,
  productHandleFromHref,
  productIdFromBrowseKey,
} from './browse-rules'

const C = '0190a7e2-1111-7000-8000-000000000001'
const P = '0190a7e2-2222-7000-8000-000000000002'

describe('productHandleFromHref', () => {
  it('reads the handle of a product page', () => {
    expect(productHandleFromHref('https://waimers.in/products/glasspad')).toBe('glasspad')
    expect(productHandleFromHref('https://waimers.in/products/glasspad/?variant=1')).toBe(
      'glasspad',
    )
    expect(productHandleFromHref('/en-ae/products/Glass%20Pad')).toBe('glass pad')
  })

  it('ignores every other page', () => {
    expect(productHandleFromHref('https://waimers.in/')).toBeNull()
    expect(productHandleFromHref('https://waimers.in/collections/pads')).toBeNull()
    expect(productHandleFromHref('https://waimers.in/products/')).toBeNull()
    expect(productHandleFromHref('https://waimers.in/products/pad/reviews')).toBeNull()
    expect(productHandleFromHref('')).toBeNull()
  })
})

describe('browse run keys', () => {
  it('keeps one key per view and reads the product back', () => {
    const at = new Date('2026-10-31T10:00:00Z')
    const key = browseKey(C, P, at)
    expect(key.startsWith(browseKeyPrefix(C, P))).toBe(true)
    expect(productIdFromBrowseKey(key)).toBe(P)
    expect(browseKey(C, P, new Date(at.getTime() + 1))).not.toBe(key)
  })

  it('reads nothing from other keys', () => {
    expect(productIdFromBrowseKey(`cart:${C}`)).toBeNull()
    expect(productIdFromBrowseKey(`lapsed:${C}`)).toBeNull()
  })
})

describe('browse window', () => {
  it('is due after the wait and within a week', () => {
    const now = new Date('2026-10-31T12:00:00Z')
    const w = browseWindow(now, 240)
    expect(w.to.toISOString()).toBe('2026-10-31T08:00:00.000Z')
    expect(w.from.toISOString()).toBe('2026-10-24T12:00:00.000Z')
    expect(browseRepeatSince(now).toISOString()).toBe('2026-10-24T12:00:00.000Z')
  })
})
