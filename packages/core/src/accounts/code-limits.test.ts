/** SOURCE OF TRUTH: sign-in code limit tests — limiter keys per store on the normalised address, and wrong guesses carried across resends */
import { describe, expect, it } from 'vitest'
import { attemptsCarriedOver, otpLimiterId } from './auth'

/** Wrong guesses carry over resends for an hour (`attemptsCarriedOver`). */
const ATTEMPT_WINDOW_MS = 60 * 60 * 1000

describe('otpLimiterId', () => {
  it('gives every spelling of one email or mobile the same bucket', () => {
    const email = otpLimiterId('s1', 'email', 'asha@example.com')
    for (const raw of [' asha@example.com', 'ASHA@example.com ', 'Asha@Example.com']) {
      expect(otpLimiterId('s1', 'email', raw)).toBe(email)
    }
    const phone = otpLimiterId('s1', 'phone', '9876543210')
    for (const raw of ['+91 98765 43210', '09876543210', '919876543210', '98765-43210']) {
      expect(otpLimiterId('s1', 'phone', raw)).toBe(phone)
    }
  })

  it('keeps stores apart', () => {
    expect(otpLimiterId('s1', 'email', 'a@b.in')).not.toBe(otpLimiterId('s2', 'email', 'a@b.in'))
  })
})

describe('attemptsCarriedOver', () => {
  const t0 = new Date('2026-09-28T10:00:00Z')

  it('keeps wrong guesses for a code resent within the window', () => {
    expect(
      attemptsCarriedOver({ createdAt: t0, attempts: 4 }, new Date(t0.getTime() + 31_000)),
    ).toBe(4)
  })

  it('starts again once the window has passed, or for a first code', () => {
    const later = new Date(t0.getTime() + ATTEMPT_WINDOW_MS)
    expect(attemptsCarriedOver({ createdAt: t0, attempts: 5 }, later)).toBe(0)
    expect(attemptsCarriedOver(undefined, t0)).toBe(0)
  })
})
