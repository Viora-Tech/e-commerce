import { describe, expect, it } from 'vitest'
import { keepPendingReferral, PENDING_REFERRAL_KEY, takePendingReferral } from './referral-pending'

function memoryStorage() {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  }
}

const blocked = {
  getItem: (): string | null => {
    throw new Error('blocked')
  },
  setItem: () => {
    throw new Error('blocked')
  },
  removeItem: () => {
    throw new Error('blocked')
  },
}

const now = new Date('2026-11-12T10:00:00Z')

/*
 * An affiliate link opened before the shopper said yes to marketing cookies: no referral cookie
 * yet. The landing is kept in this tab only (session storage), so a yes later in the visit can
 * still set the cookie; a no, or closing the tab, forgets it.
 */
describe('pending referral', () => {
  it('keeps the ref of the landing page with its time, and hands it over once', () => {
    const storage = memoryStorage()
    keepPendingReferral(storage, '?utm_source=ig&ref=Asha-K', now)
    expect(takePendingReferral(storage)).toEqual({ code: 'Asha-K', at: now.getTime() })
    expect(takePendingReferral(storage)).toBeNull()
    expect(storage.data.has(PENDING_REFERRAL_KEY)).toBe(false)
  })

  it('a page without a ref keeps the earlier landing', () => {
    const storage = memoryStorage()
    keepPendingReferral(storage, '?ref=asha-k', now)
    keepPendingReferral(storage, '?q=mouse', new Date(now.getTime() + 60_000))
    expect(takePendingReferral(storage)).toEqual({ code: 'asha-k', at: now.getTime() })
  })

  it('ignores unreadable and blocked storage', () => {
    const storage = memoryStorage()
    storage.setItem(PENDING_REFERRAL_KEY, 'not json')
    expect(takePendingReferral(storage)).toBeNull()
    expect(() => keepPendingReferral(blocked, '?ref=asha-k', now)).not.toThrow()
    expect(takePendingReferral(blocked)).toBeNull()
    expect(takePendingReferral(null)).toBeNull()
  })
})
