/** SOURCE OF TRUTH: A/B rollout tests — WHAT: the visitor hash, buckets, arm assignment and the significance test / WHY: guard Rollouts A/B tests */
import { describe, expect, it } from 'vitest'
import {
  AB_MIN_VISITORS,
  abBucket,
  abRate,
  abVerdict,
  assignArm,
  fnv1a32,
  twoProportionZ,
} from './ab'

const ROLLOUT = '0193a3c2-5b1e-7c1a-9f00-000000000001'
const OTHER = '0193a3c2-5b1e-7c1a-9f00-000000000002'
const visitor = (i: number) => `0193a3c2-0000-4000-8000-${String(i).padStart(12, '0')}`

describe('fnv1a32', () => {
  it('matches the reference FNV-1a values', () => {
    expect(fnv1a32('')).toBe(0x811c9dc5)
    expect(fnv1a32('a')).toBe(0xe40c292c)
    expect(fnv1a32('foobar')).toBe(0xbf9cf968)
  })
})

describe('abBucket', () => {
  it('is in [0, 1) and stable', () => {
    for (let i = 0; i < 200; i++) {
      const b = abBucket(ROLLOUT, visitor(i), 'arm')
      expect(b).toBeGreaterThanOrEqual(0)
      expect(b).toBeLessThan(1)
      expect(abBucket(ROLLOUT, visitor(i), 'arm')).toBe(b)
    }
  })

  it('differs by rollout and by salt', () => {
    const v = visitor(7)
    expect(abBucket(ROLLOUT, v, 'arm')).not.toBe(abBucket(OTHER, v, 'arm'))
    expect(abBucket(ROLLOUT, v, 'arm')).not.toBe(abBucket(ROLLOUT, v, 'traffic'))
  })
})

describe('assignArm', () => {
  const base = { rolloutId: ROLLOUT, traffic: 100, split: 50 }

  it('is sticky for a visitor', () => {
    for (let i = 0; i < 50; i++) {
      const a = assignArm({ ...base, visitorId: visitor(i) })
      expect(assignArm({ ...base, visitorId: visitor(i) })).toBe(a)
    }
  })

  it('leaves out visitors without an id, and bots', () => {
    expect(assignArm({ ...base, visitorId: null })).toBeNull()
    expect(assignArm({ ...base, visitorId: visitor(1), bot: true })).toBeNull()
  })

  it('splits about 50/50 by default', () => {
    let treatment = 0
    const n = 10_000
    for (let i = 0; i < n; i++) {
      if (assignArm({ ...base, visitorId: visitor(i) }) === 'treatment') treatment += 1
    }
    expect(treatment / n).toBeGreaterThan(0.47)
    expect(treatment / n).toBeLessThan(0.53)
  })

  it('follows an uneven split', () => {
    let treatment = 0
    const n = 10_000
    for (let i = 0; i < n; i++) {
      if (assignArm({ ...base, split: 20, visitorId: visitor(i) }) === 'treatment') treatment += 1
    }
    expect(treatment / n).toBeGreaterThan(0.17)
    expect(treatment / n).toBeLessThan(0.23)
  })

  it('puts only the traffic share in the test', () => {
    let tested = 0
    const n = 10_000
    for (let i = 0; i < n; i++) {
      if (assignArm({ ...base, traffic: 30, visitorId: visitor(i) }) !== null) tested += 1
    }
    expect(tested / n).toBeGreaterThan(0.27)
    expect(tested / n).toBeLessThan(0.33)
  })

  it('keeps everyone in their arm when the traffic grows', () => {
    for (let i = 0; i < 2_000; i++) {
      const before = assignArm({ ...base, traffic: 20, visitorId: visitor(i) })
      if (before === null) continue
      expect(assignArm({ ...base, traffic: 80, visitorId: visitor(i) })).toBe(before)
    }
  })
})

describe('twoProportionZ', () => {
  it('is 0 without visitors or without a difference', () => {
    expect(twoProportionZ({ visitors: 0, conversions: 0 }, { visitors: 10, conversions: 1 })).toBe(
      0,
    )
    expect(
      twoProportionZ({ visitors: 1000, conversions: 50 }, { visitors: 1000, conversions: 50 }),
    ).toBe(0)
  })

  it('matches a worked example', () => {
    // 5% vs 6.5% on 2,000 visitors each: pooled 5.75%, z ≈ 2.04.
    const z = twoProportionZ(
      { visitors: 2000, conversions: 100 },
      { visitors: 2000, conversions: 130 },
    )
    expect(z).toBeCloseTo(2.04, 2)
  })

  it('is negative when the Control converts better', () => {
    expect(
      twoProportionZ({ visitors: 2000, conversions: 130 }, { visitors: 2000, conversions: 100 }),
    ).toBeLessThan(0)
  })
})

describe('abVerdict', () => {
  it('asks for more data under the minimums', () => {
    expect(
      abVerdict(
        { visitors: AB_MIN_VISITORS - 1, conversions: 5 },
        { visitors: 5000, conversions: 500 },
      ),
    ).toEqual({ kind: 'not_enough' })
    expect(abVerdict({ visitors: 500, conversions: 2 }, { visitors: 500, conversions: 3 })).toEqual(
      { kind: 'not_enough' },
    )
  })

  it('names the Treatment ahead at ~95%', () => {
    expect(
      abVerdict({ visitors: 2000, conversions: 100 }, { visitors: 2000, conversions: 130 }),
    ).toEqual({ kind: 'ahead', arm: 'treatment', confidence: 95 })
  })

  it('names the Control ahead at ~99%', () => {
    expect(
      abVerdict({ visitors: 2000, conversions: 160 }, { visitors: 2000, conversions: 100 }),
    ).toEqual({ kind: 'ahead', arm: 'control', confidence: 99 })
  })

  it('says no clear winner for a small gap', () => {
    expect(
      abVerdict({ visitors: 2000, conversions: 100 }, { visitors: 2000, conversions: 105 }),
    ).toEqual({ kind: 'no_difference' })
  })
})

describe('abRate', () => {
  it('divides, and is 0 with nobody', () => {
    expect(abRate(1, 4)).toBe(0.25)
    expect(abRate(3, 0)).toBe(0)
  })
})
