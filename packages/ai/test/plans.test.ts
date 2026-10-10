import { describe, expect, it } from 'vitest'
import { parseFeatureToggles } from '../src/features'
import { aiMonth, checkQuota, PLAN_QUOTAS, parseAiPlan } from '../src/plans'

const used = (calls: number, tokens = 0) => ({ calls, inputTokens: tokens, outputTokens: 0 })

describe('checkQuota', () => {
  it('allows calls under the plan limits', () => {
    expect(checkQuota('starter', used(0))).toEqual({ ok: true })
    expect(checkQuota('starter', used(299, 10_000))).toEqual({ ok: true })
  })

  it('stops at the call limit', () => {
    expect(checkQuota('starter', used(300))).toEqual({ ok: false, reason: 'calls' })
    expect(checkQuota('free', used(30))).toEqual({ ok: false, reason: 'calls' })
  })

  it('stops at the token limit, input and output together', () => {
    const limit = PLAN_QUOTAS.starter.tokens as number
    expect(checkQuota('starter', { calls: 1, inputTokens: limit - 10, outputTokens: 10 })).toEqual({
      ok: false,
      reason: 'tokens',
    })
  })

  it('never stops the unlimited plan', () => {
    expect(checkQuota('unlimited', used(1_000_000, 1_000_000_000))).toEqual({ ok: true })
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
