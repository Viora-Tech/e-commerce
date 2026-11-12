/** SOURCE OF TRUTH: hono preview token tests, keepOwnerOnlyPreferences tests
 * WHAT:  The owner's preview link token (store, expiry, forgery) and the owner-only save rule.
 * WHY:   A shared or forged link must turn nothing on, and only the owner changes the switch.
 */
import { describe, expect, it } from 'vitest'
import {
  HONO_PREVIEW_TTL_SECONDS,
  keepOwnerOnlyPreferences,
  readHonoPreviewToken,
  signHonoPreviewToken,
} from './hono-preview'
import { parsePreferences } from './preferences'

describe('hono preview token', () => {
  const secret = 's3cret'
  const storeId = 'store-1'
  const now = 1_800_000_000_000

  it('is good for its store until it expires', () => {
    const token = signHonoPreviewToken({ secret, storeId, now })
    expect(readHonoPreviewToken({ secret, storeId, token, now })).toBe(true)
    const later = now + (HONO_PREVIEW_TTL_SECONDS - 1) * 1000
    expect(readHonoPreviewToken({ secret, storeId, token, now: later })).toBe(true)
    const expired = now + HONO_PREVIEW_TTL_SECONDS * 1000
    expect(readHonoPreviewToken({ secret, storeId, token, now: expired })).toBe(false)
  })

  it('never works for another store, another secret, or when altered', () => {
    const token = signHonoPreviewToken({ secret, storeId, now })
    expect(readHonoPreviewToken({ secret, storeId: 'store-2', token, now })).toBe(false)
    expect(readHonoPreviewToken({ secret: 'other', storeId, token, now })).toBe(false)
    expect(readHonoPreviewToken({ secret: '', storeId, token, now })).toBe(false)
    const [exp, sig] = token.split('.')
    expect(
      readHonoPreviewToken({ secret, storeId, token: `${Number(exp) + 999}.${sig}`, now }),
    ).toBe(false)
    for (const bad of ['on', '', `${exp}`, `${exp}.${sig}.x`, 'x'.repeat(500)]) {
      expect(readHonoPreviewToken({ secret, storeId, token: bad, now }), bad).toBe(false)
    }
  })
})

describe('keepOwnerOnlyPreferences', () => {
  const stored = parsePreferences({ delivery: { honoProduct: true } })
  const sent = parsePreferences({ delivery: { plainHtml: true, honoProduct: false } })

  it('lets the owner change the faster product pages switch', () => {
    expect(keepOwnerOnlyPreferences(sent, stored, true).delivery).toEqual({
      plainHtml: true,
      honoProduct: false,
    })
  })

  it('keeps it as stored for anyone else, and saves the rest of their changes', () => {
    expect(keepOwnerOnlyPreferences(sent, stored, false).delivery).toEqual({
      plainHtml: true,
      honoProduct: true,
    })
    const off = parsePreferences({})
    const tried = parsePreferences({ delivery: { honoProduct: true } })
    expect(keepOwnerOnlyPreferences(tried, off, false).delivery.honoProduct).toBe(false)
  })
})
