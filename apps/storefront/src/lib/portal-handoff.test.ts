import { describe, expect, it } from 'vitest'
import { referralLink } from './portal-format'
import { openPortalHandoff, PORTAL_HANDOFF_TTL_MS, signPortalHandoff } from './portal-handoff'

const SECRET = 'test-secret-test-secret-test-secret-00'
const STORE = '00000000-0000-4000-8000-000000000001'
const OTHER = '00000000-0000-4000-8000-000000000002'
const CUSTOMER = '00000000-0000-4000-8000-0000000000aa'

describe('portal sign-in hand-off', () => {
  it('carries the customer to the same store, with a nonce', () => {
    const t = signPortalHandoff(STORE, CUSTOMER, SECRET)
    const opened = openPortalHandoff(t, STORE, SECRET)
    expect(opened?.customerId).toBe(CUSTOMER)
    expect(opened?.nonce.length).toBeGreaterThan(8)
    // Each token has its own nonce, so each is spent separately.
    expect(
      openPortalHandoff(signPortalHandoff(STORE, CUSTOMER, SECRET), STORE, SECRET)?.nonce,
    ).not.toBe(opened?.nonce)
  })

  it('refuses another store, another secret, a tampered or an expired token', () => {
    const now = Date.now()
    const t = signPortalHandoff(STORE, CUSTOMER, SECRET, now)
    expect(openPortalHandoff(t, OTHER, SECRET)).toBeNull()
    expect(openPortalHandoff(t, STORE, `${SECRET}x`)).toBeNull()
    expect(openPortalHandoff(`${t}x`, STORE, SECRET)).toBeNull()
    expect(
      openPortalHandoff(t, STORE, SECRET, new Date(now + PORTAL_HANDOFF_TTL_MS + 1)),
    ).toBeNull()
    expect(openPortalHandoff(null, STORE, SECRET)).toBeNull()
  })
})

describe('referralLink', () => {
  const origin = 'https://www.waimers.in'

  it('adds ref, and utm_source when given, to a page of the store', () => {
    expect(referralLink(origin, '/', 'asha')).toBe('https://www.waimers.in/?ref=asha')
    expect(referralLink(origin, '/products/mat', 'asha', 'Instagram Bio!')).toBe(
      'https://www.waimers.in/products/mat?ref=asha&utm_source=instagram-bio',
    )
    expect(referralLink(origin, 'https://www.waimers.in/collections/all?x=1', 'asha')).toBe(
      'https://www.waimers.in/collections/all?x=1&ref=asha',
    )
  })

  it('refuses another site', () => {
    expect(referralLink(origin, 'https://evil.example/', 'asha')).toBeNull()
  })
})
