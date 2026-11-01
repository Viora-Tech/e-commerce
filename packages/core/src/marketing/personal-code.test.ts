/** SOURCE OF TRUTH: personal discount code tests — WHAT: one code per shopper and message, the same on a retry / WHY: guard the email discount block */
import { describe, expect, it } from 'vitest'
import { personalCodeFor } from './personal-code'

describe('personalCodeFor', () => {
  it('is the same for the same message, and a code the discount form accepts', () => {
    const id = '01a18f2c-7d0e-7c3a-9b1e-2f4a5c6d7e8f'
    const code = personalCodeFor(id, 'Welcome new subscribers')
    expect(code).toBe(personalCodeFor(id, 'Welcome new subscribers'))
    expect(code).toMatch(/^WELCOMENEWSU-[0-9A-F]{8}$/)
    // Discount codes: letters, numbers and hyphens, 2 to 40.
    expect(code).toMatch(/^[A-Z0-9-]{2,40}$/)
    expect(personalCodeFor(id, '10% off!')).toMatch(/^OFF-/)
    expect(personalCodeFor(id, '123')).toMatch(/^THANKS-/)
  })
})
