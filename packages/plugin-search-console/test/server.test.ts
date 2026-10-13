import { describe, expect, it } from 'vitest'
import { pkceChallenge } from '../src/google'
import {
  pkceVerifier,
  searchRanges,
  signSearchConsoleState,
  toSearchRow,
  verifySearchConsoleState,
} from '../src/server'

const SECRET = 'test-secret-at-least-16'
const STORE = '0190a5b2-0000-7000-8000-000000000001'

describe('OAuth state', () => {
  it('round-trips the store and nonce', () => {
    const { state, nonce } = signSearchConsoleState(STORE, SECRET)
    expect(verifySearchConsoleState(state, SECRET)).toEqual({ storeId: STORE, nonce })
  })

  it('refuses a forged, tampered or expired state', () => {
    const now = new Date('2026-10-14T10:00:00Z')
    const { state } = signSearchConsoleState(STORE, SECRET, now)
    expect(verifySearchConsoleState(state, 'another-secret-entirely', now)).toBeNull()
    expect(verifySearchConsoleState(`${state}x`, SECRET, now)).toBeNull()
    expect(verifySearchConsoleState('garbage', SECRET, now)).toBeNull()
    const later = new Date(now.getTime() + 31 * 60_000)
    expect(verifySearchConsoleState(state, SECRET, later)).toBeNull()
  })
})

describe('PKCE', () => {
  it('derives a 43-character verifier per nonce, and its S256 challenge', () => {
    const v = pkceVerifier('nonce-1', SECRET)
    expect(v).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(pkceVerifier('nonce-1', SECRET)).toBe(v)
    expect(pkceVerifier('nonce-2', SECRET)).not.toBe(v)
    expect(pkceChallenge(v)).toMatch(/^[A-Za-z0-9_-]{43}$/)
  })
})

describe('searchRanges', () => {
  it('ends three Pacific days back and covers 28 days each', () => {
    // 2026-10-14 05:00 UTC is still 2026-10-13 in California.
    const r = searchRanges(new Date('2026-10-14T05:00:00Z'))
    expect(r.current).toEqual({ start: '2026-09-13', end: '2026-10-10' })
    expect(r.previous).toEqual({ start: '2026-08-16', end: '2026-09-12' })
  })
})

describe('toSearchRow', () => {
  it('places keys by the dimensions asked for and matches the page path', () => {
    expect(
      toSearchRow('current', 'page_query', ['page', 'query'], {
        keys: ['https://shop.in/products/Kurta', 'blue kurta'],
        clicks: 3,
        impressions: 40,
        ctr: 0.075,
        position: 6.2,
      }),
    ).toEqual({
      period: 'current',
      dimension: 'page_query',
      page: 'https://shop.in/products/Kurta',
      path: '/products/kurta',
      query: 'blue kurta',
      segment: null,
      clicks: 3,
      impressions: 40,
      position: 6.2,
    })
    expect(toSearchRow('previous', 'country', ['country'], { keys: ['ind'] }).segment).toBe('ind')
    expect(toSearchRow('current', 'total', [], { clicks: 9 }).clicks).toBe(9)
  })
})
