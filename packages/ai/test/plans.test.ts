import { describe, expect, it } from 'vitest'
import { parseFeatureToggles } from '../src/features'
import { aiMonth, checkQuota, creditMillisFor, PLAN_QUOTAS, parseAiPlan } from '../src/plans'

const used = (calls: number, tokens = 0, credits = 0) => ({
  calls,
  inputTokens: tokens,
  outputTokens: 0,
  credits,
})

describe('checkQuota', () => {
  it('allows calls under the plan limits', () => {
    expect(checkQuota('starter', used(0))).toEqual({ ok: true })
    expect(checkQuota('starter', used(299, 10_000, 499))).toEqual({ ok: true })
  })

  it('stops when the month credits are used, unless bought credits are left', () => {
    expect(checkQuota('starter', used(10, 0, 500))).toEqual({ ok: false, reason: 'credits' })
    expect(checkQuota('starter', used(10, 0, 500), 100)).toEqual({ ok: true })
    expect(checkQuota('starter', used(10, 0, 600), 100)).toEqual({ ok: false, reason: 'credits' })
  })

  it('stops at the call safety cap', () => {
    expect(checkQuota('free', used(30))).toEqual({ ok: false, reason: 'calls' })
  })

  it('stops at the token safety cap, input and output together', () => {
    const limit = PLAN_QUOTAS.starter.tokens as number
    expect(
      checkQuota('starter', { calls: 1, inputTokens: limit - 10, outputTokens: 10, credits: 0 }),
    ).toEqual({ ok: false, reason: 'tokens' })
  })

  it('gives Pro 15,000 credits and no call or token cap', () => {
    expect(checkQuota('unlimited', used(1_000_000, 1_000_000_000, 14_999))).toEqual({ ok: true })
    expect(checkQuota('unlimited', used(1, 0, 15_000))).toEqual({ ok: false, reason: 'credits' })
  })
})

describe('creditMillisFor', () => {
  it('prices tokens by tier, rounding up to a thousandth of a credit', () => {
    // 3k in + 2k out on the fast tier: (3000 × 8.5 + 2000 × 42.5) / 1e6 = ₹0.1105 → 1.105 credits.
    expect(creditMillisFor('fast', 3_000, 2_000)).toBe(1105)
    expect(creditMillisFor('strong', 3_000, 2_000)).toBeGreaterThan(30_000)
    expect(creditMillisFor('fast', 0, 0)).toBe(0)
  })
})

describe('aiMonth', () => {
  it('buckets by the calendar month in India, not UTC', () => {
    // 31 Oct 2026 20:00 UTC is already 1 Nov 01:30 in India.
    expect(aiMonth(new Date('2026-10-31T20:00:00Z'))).toBe('2026-11')
    expect(aiMonth(new Date('2026-10-31T18:00:00Z'))).toBe('2026-10')
  })
})

describe('parsers', () => {
  it('falls back to the default plan for junk', () => {
    expect(parseAiPlan('growth')).toBe('growth')
    expect(parseAiPlan('enterprise')).toBe('starter')
    expect(parseAiPlan(null)).toBe('starter')
  })

  it('treats missing feature toggles as on', () => {
    expect(parseFeatureToggles(null)).toEqual({
      productWriter: true,
      assistant: true,
      bulkWriter: true,
      documentReader: true,
    })
    expect(parseFeatureToggles({ bulkWriter: false, junk: 1 })).toEqual({
      productWriter: true,
      assistant: true,
      bulkWriter: false,
      documentReader: true,
    })
  })
})
