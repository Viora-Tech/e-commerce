/** SOURCE OF TRUTH: phone sign-in match tests — only a proven phone, or a phone-only customer, is signed in by a proven number */
import { describe, expect, it } from 'vitest'
import { mayUsePhoneForSignIn, phoneSignInMatch } from './phone-proof'

const proven = new Date('2026-09-28T10:00:00Z')

describe('phone sign-in match', () => {
  it('never signs in as a customer whose phone was only typed at checkout', () => {
    expect(mayUsePhoneForSignIn({ id: 'v', email: 'victim@x.in', phoneVerifiedAt: null })).toBe(
      false,
    )
  })

  it('signs in a proven phone, or a phone-only customer', () => {
    expect(mayUsePhoneForSignIn({ id: 'a', email: 'a@x.in', phoneVerifiedAt: proven })).toBe(true)
    expect(mayUsePhoneForSignIn({ id: 'b', email: null, phoneVerifiedAt: null })).toBe(true)
  })

  it('skips an unproven newer row for the proven one behind it', () => {
    const rows = [
      { id: 'victim', email: 'victim@x.in', phoneVerifiedAt: null },
      { id: 'mine', email: null, phoneVerifiedAt: proven },
    ]
    expect(phoneSignInMatch(rows)?.id).toBe('mine')
    expect(phoneSignInMatch([rows[0] as (typeof rows)[number]])).toBeUndefined()
  })
})
