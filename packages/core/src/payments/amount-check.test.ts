/** SOURCE OF TRUTH: gateway amount check tests — a webhook reporting less than the attempt never marks it paid */
import { describe, expect, it } from 'vitest'
import { gatewayPaidTooLittle } from './confirm'

describe('gatewayPaidTooLittle', () => {
  it('refuses less than the attempt, or a missing amount', () => {
    expect(gatewayPaidTooLittle(500_000, 100)).toBe(true)
    expect(gatewayPaidTooLittle(500_000, Number.NaN)).toBe(true)
  })

  it('accepts the exact amount, or more (gateway fees)', () => {
    expect(gatewayPaidTooLittle(500_000, 500_000)).toBe(false)
    expect(gatewayPaidTooLittle(500_000, 501_180)).toBe(false)
  })
})
