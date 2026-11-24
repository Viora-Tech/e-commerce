/** SOURCE OF TRUTH: loyalty v2 pure rules tests — WHAT: program access, points names, boosts, the ledger-only replay, tier pick, campaign boost, reward prices, referral fraud keys, the import parser and the input schemas / WHY: these pure rules decide points and money, so they are checked without a database */
import { describe, expect, it } from 'vitest'
import { replayLedgerLots } from './balance'
import { boostFrom, type LoyaltyCampaignRow } from './campaigns'
import { parsePointsCsv } from './members'
import { addressKey, inboxOf } from './referrals'
import { rewardPrice } from './rewards'
import {
  EarnRuleInputSchema,
  LoyaltyCampaignInputSchema,
  parseRuleSettings,
  RewardInputSchema,
} from './schemas'
import { boostedPoints, defaultLoyaltySettings, pointsLabel, programOpenTo } from './settings'
import { tierFor } from './tiers'

const d = (s: string) => new Date(`${s}T00:00:00Z`)

describe('program access', () => {
  const s = defaultLoyaltySettings
  it('lets everyone in while live, except excluded tags (any case)', () => {
    expect(programOpenTo(s, { email: 'a@x.in', tags: [] })).toBe(true)
    const ex = { ...s, excludeTags: ['Staff'] }
    expect(programOpenTo(ex, { email: 'a@x.in', tags: ['staff'] })).toBe(false)
  })
  it('only test accounts while paused', () => {
    const p = { ...s, programStatus: 'paused' as const, testEmails: ['qa@x.in'] }
    expect(programOpenTo(p, { email: 'QA@x.in', tags: [] })).toBe(true)
    expect(programOpenTo(p, { email: 'a@x.in', tags: [] })).toBe(false)
    expect(programOpenTo(p, { email: null, tags: [] })).toBe(false)
  })
})

describe('points numbers', () => {
  it('names points in the store’s words', () => {
    const s = { pointsNameSingular: 'coin', pointsNamePlural: 'coins' }
    expect(pointsLabel(1, s)).toBe('1 coin')
    expect(pointsLabel(25, s)).toBe('25 coins')
  })
  it('boosts order points by a multiplier and adds a fixed bonus, never on nothing', () => {
    expect(boostedPoints(25, 12_500, 0)).toBe(31)
    expect(boostedPoints(25, 20_000, 10)).toBe(60)
    expect(boostedPoints(0, 20_000, 10)).toBe(0)
  })
})

describe('ledger-only replay', () => {
  const line = (
    id: string,
    points: number,
    created: string,
    expires: string | null,
    extra = {},
  ) => ({
    id,
    points,
    source: (points > 0 ? 'rule' : 'redemption') as 'rule',
    earnKey: null as string | null,
    expiresAt: expires ? d(expires) : null,
    createdAt: d(created),
    ...extra,
  })
  it('spends the soonest expiry first and drops expired credits', () => {
    const lots = replayLedgerLots(
      [
        line('a', 100, '2026-01-01', '2027-01-01'),
        line('b', 50, '2026-02-01', '2026-06-01'),
        line('c', -60, '2026-03-01', null),
      ],
      d('2026-04-01'),
    )
    expect(lots).toEqual([{ entryId: 'a', remaining: 90, expiresAt: d('2027-01-01') }])
    expect(replayLedgerLots([line('b', 50, '2026-02-01', '2026-06-01')], d('2026-07-01'))).toEqual(
      [],
    )
  })
  it('an expiry line empties only the credit it names', () => {
    const lots = replayLedgerLots(
      [
        line('a', 40, '2026-01-01', '2026-02-01'),
        line('b', 30, '2026-01-02', null),
        line('x', -40, '2026-02-01', null, { source: 'expiry', earnKey: 'expiry:a' }),
      ],
      d('2026-03-01'),
    )
    expect(lots).toEqual([{ entryId: 'b', remaining: 30, expiresAt: null }])
  })
})

describe('tiers and campaigns', () => {
  const tiers = [
    { id: 'bronze', threshold: 0 },
    { id: 'silver', threshold: 500 },
    { id: 'gold', threshold: 2000 },
  ]
  it('picks the highest tier reached', () => {
    expect(tierFor(tiers, 0)?.id).toBe('bronze')
    expect(tierFor(tiers, 499)?.id).toBe('bronze')
    expect(tierFor(tiers, 2000)?.id).toBe('gold')
    expect(tierFor([{ id: 's', threshold: 10 }], 5)).toBeNull()
  })
  it('takes the highest multiplier running and adds every fixed bonus, by tier', () => {
    const c = (over: Partial<LoyaltyCampaignRow>): LoyaltyCampaignRow => ({
      id: 'c',
      storeId: 's',
      name: 'x',
      startsAt: d('2026-11-01'),
      endsAt: d('2026-12-01'),
      tierIds: [],
      bonusType: 'multiplier',
      multiplierBp: 20_000,
      bonusPoints: 0,
      active: true,
      createdAt: d('2026-11-01'),
      updatedAt: d('2026-11-01'),
      ...over,
    })
    const list = [
      c({ id: 'two' }),
      c({ id: 'three', multiplierBp: 30_000, tierIds: ['gold'] }),
      c({ id: 'fixed', bonusType: 'fixed', bonusPoints: 15 }),
      c({ id: 'off', multiplierBp: 50_000, active: false }),
      c({ id: 'old', multiplierBp: 50_000, endsAt: d('2026-11-10') }),
    ]
    expect(boostFrom(list, 'bronze', d('2026-11-20'))).toEqual({
      multiplierBp: 20_000,
      bonusPoints: 15,
      campaignId: 'two',
    })
    expect(boostFrom(list, 'gold', d('2026-11-20')).multiplierBp).toBe(30_000)
    expect(boostFrom(list, null, d('2026-12-02'))).toEqual({
      multiplierBp: 10_000,
      bonusPoints: 0,
      campaignId: null,
    })
  })
})

describe('reward prices', () => {
  const custom = {
    type: 'custom_amount_off' as const,
    pointsCost: 100,
    value: 5_000,
    minPoints: 100,
    maxPoints: 1_000,
  }
  it('a custom amount takes whole steps inside min and max', () => {
    expect(rewardPrice(custom, 300)).toEqual({ cost: 300, value: 15_000 })
    expect(rewardPrice(custom, 250)).toBeNull()
    expect(rewardPrice(custom, 2_000)).toBeNull()
    expect(rewardPrice(custom, null)).toBeNull()
  })
  it('other rewards cost their points', () => {
    expect(rewardPrice({ ...custom, type: 'amount_off' })).toEqual({ cost: 100, value: 5_000 })
  })
})

describe('referral fraud keys', () => {
  it('treats Gmail dots and plus tags as one inbox', () => {
    expect(inboxOf('Asha.K+promo@gmail.com')).toBe('ashak@gmail.com')
    expect(inboxOf('asha.k@googlemail.com')).toBe('ashak@gmail.com')
    expect(inboxOf('a.b+x@example.com')).toBe('a.b@example.com')
  })
  it('compares addresses by first line and PIN code', () => {
    expect(addressKey({ line1: '12, MG Road', pincode: '560001' })).toBe(
      addressKey({ line1: '12 mg road', pincode: '560 001' }),
    )
    expect(addressKey(null)).toBe('')
  })
})

describe('import file', () => {
  it('reads email and points in any column order and reports bad rows', () => {
    const r = parsePointsCsv('Points,Email\n120,asha@x.in\nabc,ravi@x.in\n5,\n')
    expect(r.rows).toEqual([{ email: 'asha@x.in', points: 120 }])
    expect(r.errors.map((e) => e.line)).toEqual([3, 4])
    expect(parsePointsCsv('name\nx').errors[0]?.message).toMatch(/email and points/)
  })
})

describe('input schemas', () => {
  it('checks each rule type’s settings', () => {
    expect(
      EarnRuleInputSchema.safeParse({
        type: 'social',
        key: 'instagram',
        points: 10,
        settings: { url: 'https://instagram.com/w' },
      }).success,
    ).toBe(true)
    expect(
      EarnRuleInputSchema.safeParse({
        type: 'social',
        key: 'myspace',
        points: 10,
        settings: { url: 'https://x.y' },
      }).success,
    ).toBe(false)
    expect(
      EarnRuleInputSchema.safeParse({ type: 'google_review', points: 10, settings: {} }).success,
    ).toBe(false)
    expect(EarnRuleInputSchema.safeParse({ type: 'order_spend', points: 101 }).success).toBe(false)
    expect(parseRuleSettings('visit_streak', {}).days).toBe(7)
  })
  it('checks each reward type’s value', () => {
    expect(
      RewardInputSchema.safeParse({
        type: 'percent_off',
        title: '10%',
        pointsCost: 100,
        value: 1_000,
      }).success,
    ).toBe(true)
    expect(
      RewardInputSchema.safeParse({
        type: 'percent_off',
        title: 'x',
        pointsCost: 100,
        value: 20_000,
      }).success,
    ).toBe(false)
    expect(
      RewardInputSchema.safeParse({ type: 'free_product', title: 'x', pointsCost: 100 }).success,
    ).toBe(false)
    expect(
      RewardInputSchema.safeParse({ type: 'amount_off', title: 'x', pointsCost: 100, value: 0 })
        .success,
    ).toBe(false)
  })
  it('a campaign ends after it starts', () => {
    expect(
      LoyaltyCampaignInputSchema.safeParse({
        name: 'x',
        startsAt: '2026-11-02',
        endsAt: '2026-11-01',
        bonusType: 'fixed',
      }).success,
    ).toBe(false)
  })
})
