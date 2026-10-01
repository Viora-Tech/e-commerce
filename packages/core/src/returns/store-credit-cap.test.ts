/** SOURCE OF TRUTH: store credit cap tests — a return becomes at most the returned goods' value, an RTO at most what was paid */
import { describe, expect, it } from 'vitest'
import { storeCreditCapPaise } from './resolve'

describe('storeCreditCapPaise', () => {
  it('caps a return at what the returned lines sold for after discount', () => {
    expect(storeCreditCapPaise({ kind: 'return', goodsPaise: 90_000, availablePaise: 0 })).toBe(
      90_000,
    )
  })

  it('caps an RTO at what was paid and not refunded (nothing for unpaid COD)', () => {
    expect(storeCreditCapPaise({ kind: 'rto', goodsPaise: 90_000, availablePaise: 0 })).toBe(0)
    expect(storeCreditCapPaise({ kind: 'rto', goodsPaise: 90_000, availablePaise: 50_000 })).toBe(
      50_000,
    )
  })
})
