/** SOURCE OF TRUTH: loyalty v2 earning tests — WHAT: v1 settings become rules with the same results, each earning rule type gives its points (once where once-only), order points follow shipping, GST and excluded tags, tiers qualify by points or spend and multiply order points, campaigns boost orders in their window, expired points are recorded and the emails queue once / WHY: every rule moves points that are money, so each must give exactly what the merchant set, once */
import {
  customer,
  loyaltyEarnRule,
  loyaltyEntry,
  loyaltyMember,
  loyaltyNotification,
  loyaltyTierChange,
  order,
  product,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { and, eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { addPoints } from './balance'
import { saveLoyaltyCampaign } from './campaigns'
import { creditDueEntry, duePointEntryIds, planOrderPoints, reverseOrderPoints } from './earn'
import { recordExpiredPoints } from './expiry'
import { grantBirthdayPoints } from './extras'
import {
  app,
  at,
  deliveredOrder,
  owner,
  run,
  type Seed,
  seed,
  settingsWith,
  signIn,
  T0,
} from './fixtures.test-util'
import {
  claimActionRule,
  grantAnniversaryPoints,
  grantNewsletterPoints,
  grantSignupPoints,
  planFirstOrderBonus,
  recordVisit,
} from './grants'
import { pointsSummary } from './ledger'
import { ensureMember } from './member'
import { queuePointsExpiryEmails } from './notify'
import { ensureEarnRules, saveEarnRule } from './rules'
import type { LoyaltySettings } from './settings'
import { recalcTier, saveTier, tierValue } from './tiers'

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

beforeEach(async () => {
  await resetDb(owner)
})

const S = settingsWith()

const balance = (t: Seed, now: Date, customerId = t.customerId) =>
  run(t.storeId, async (ctx) => (await pointsSummary(ctx, customerId, 0, now)).points)

const rule = (t: Seed, input: Record<string, unknown>) =>
  run(t.storeId, (ctx) => saveEarnRule(ctx, null, input, T0))

/** Delivery at T0, then the sweep's credit step at `now`. */
async function earnOrder(t: Seed, orderId: string, now: Date, s: LoyaltySettings = S) {
  const row = await run(t.storeId, (ctx) => planOrderPoints(ctx, orderId, s, T0))
  const ids = await run(t.storeId, (ctx) => duePointEntryIds(ctx, now))
  for (const id of ids) await run(t.storeId, (ctx) => creditDueEntry(ctx, id, s, now))
  return row
}

describe('v1 settings become rules', () => {
  it('makes order, review and birthday rules from the v1 numbers, once, and earns the same', async () => {
    const t = await seed()
    const v1 = settingsWith({ pointsPer100: 2, reviewPoints: 0, birthdayPoints: 70 })
    const { orderId } = await deliveredOrder(t, 250_000)
    const before = await run(t.storeId, (ctx) => planOrderPoints(ctx, orderId, v1, T0))
    expect(before?.points).toBe(50)
    expect(await run(t.storeId, (ctx) => ensureEarnRules(ctx, v1))).toBe(true)
    expect(await run(t.storeId, (ctx) => ensureEarnRules(ctx, v1))).toBe(false)
    const rules = await owner.select().from(loyaltyEarnRule)
    expect(rules.map((r) => [r.type, r.points, r.enabled]).sort()).toEqual([
      ['birthday', 70, true],
      ['order_spend', 2, true],
      ['product_review', 0, false],
    ])
    // The rules now decide: a second order earns at the rule's rate, whatever settings say.
    const second = await deliveredOrder(t, 250_000)
    const after = await run(t.storeId, (ctx) =>
      planOrderPoints(ctx, second.orderId, settingsWith(), T0),
    )
    expect(after?.points).toBe(50)
    await owner.update(customer).set({ birthday: '11-23' }).where(eq(customer.id, t.customerId))
    expect(await run(t.storeId, (ctx) => grantBirthdayPoints(ctx, settingsWith(), T0))).toBe(1)
    const [b] = await owner.select().from(loyaltyEntry).where(eq(loyaltyEntry.source, 'birthday'))
    expect(b?.points).toBe(70)
  })
})

describe('earning rules', () => {
  it('sign up needs a storefront sign-in, and gives once', async () => {
    const t = await seed()
    await rule(t, { type: 'signup', points: 50 })
    expect(await run(t.storeId, (ctx) => grantSignupPoints(ctx, t.customerId, S, T0))).toBeNull()
    await signIn(t, t.customerId)
    expect(
      (await run(t.storeId, (ctx) => grantSignupPoints(ctx, t.customerId, S, T0)))?.points,
    ).toBe(50)
    expect(await run(t.storeId, (ctx) => grantSignupPoints(ctx, t.customerId, S, T0))).toBeNull()
    expect(await balance(t, T0)).toBe(50)
  })

  it('newsletter gives once, only to a subscriber; an off rule gives nothing', async () => {
    const t = await seed()
    const r = await rule(t, { type: 'newsletter', points: 30 })
    expect(
      await run(t.storeId, (ctx) => grantNewsletterPoints(ctx, t.customerId, S, T0)),
    ).toBeNull()
    await owner.update(customer).set({ acceptsMarketing: true })
    await run(t.storeId, (ctx) => grantNewsletterPoints(ctx, t.customerId, S, T0))
    await run(t.storeId, (ctx) => grantNewsletterPoints(ctx, t.customerId, S, T0))
    expect(await balance(t, T0)).toBe(30)
    await run(t.storeId, (ctx) =>
      saveEarnRule(ctx, r.id, { type: 'newsletter', points: 30, enabled: false }),
    )
    expect(await run(t.storeId, (ctx) => grantNewsletterPoints(ctx, t.otherId, S, T0))).toBeNull()
  })

  it('first order bonus waits for the return window, only for the first order', async () => {
    const t = await seed()
    await rule(t, { type: 'first_order', points: 100 })
    const first = await deliveredOrder(t, 100_000)
    const second = await deliveredOrder(t, 100_000, { placedAt: at(1) })
    expect(
      (await run(t.storeId, (ctx) => planFirstOrderBonus(ctx, first.orderId, S, T0)))?.status,
    ).toBe('pending')
    expect(
      await run(t.storeId, (ctx) => planFirstOrderBonus(ctx, second.orderId, S, T0)),
    ).toBeNull()
    expect(await balance(t, at(1))).toBe(0)
    const ids = await run(t.storeId, (ctx) => duePointEntryIds(ctx, at(30)))
    for (const id of ids) await run(t.storeId, (ctx) => creditDueEntry(ctx, id, S, at(30)))
    expect(await balance(t, at(30))).toBe(100)
  })

  it('daily visit once a day, streak bonus every N days in a row, broken by a missed day', async () => {
    const t = await seed()
    await rule(t, { type: 'daily_visit', points: 2 })
    await rule(t, { type: 'visit_streak', points: 20, settings: { days: 3 } })
    const visit = (d: number, h = 0) =>
      run(t.storeId, (ctx) =>
        recordVisit(ctx, t.customerId, S, new Date(at(d).getTime() + h * 3_600_000)),
      )
    expect(await visit(0)).toMatchObject({ counted: true, streakDays: 1, points: 2 })
    expect(await visit(0, 2)).toMatchObject({ counted: false, points: 0 })
    await visit(1)
    expect(await visit(2)).toMatchObject({ streakDays: 3, points: 22 })
    expect(await visit(4)).toMatchObject({ streakDays: 1, points: 2 })
    expect(await balance(t, at(4))).toBe(2 * 4 + 20)
  })

  it('social and Google review click-throughs give once each and return the link', async () => {
    const t = await seed()
    const ig = await rule(t, {
      type: 'social',
      key: 'instagram',
      points: 15,
      settings: { url: 'https://instagram.com/waimers' },
    })
    const yt = await rule(t, {
      type: 'social',
      key: 'youtube',
      points: 10,
      settings: { url: 'https://youtube.com/@w' },
    })
    const g = await rule(t, {
      type: 'google_review',
      points: 40,
      settings: { url: 'https://g.page/r/w' },
    })
    expect(await run(t.storeId, (ctx) => claimActionRule(ctx, t.customerId, ig.id, S, T0))).toEqual(
      { url: 'https://instagram.com/waimers', points: 15 },
    )
    expect(
      (await run(t.storeId, (ctx) => claimActionRule(ctx, t.customerId, ig.id, S, T0))).points,
    ).toBe(0)
    await run(t.storeId, (ctx) => claimActionRule(ctx, t.customerId, yt.id, S, T0))
    await run(t.storeId, (ctx) => claimActionRule(ctx, t.customerId, g.id, S, T0))
    expect(await balance(t, T0)).toBe(65)
    const signup = await rule(t, { type: 'signup', points: 5 })
    await expect(
      run(t.storeId, (ctx) => claimActionRule(ctx, t.customerId, signup.id, S, T0)),
    ).rejects.toMatchObject({ reason: 'not_found' })
  })

  it('membership anniversary once a year, not in the joining year', async () => {
    const t = await seed()
    await rule(t, { type: 'anniversary', points: 75 })
    await run(t.storeId, (ctx) => ensureMember(ctx, t.customerId, new Date('2025-11-23T06:00:00Z')))
    await run(t.storeId, (ctx) => ensureMember(ctx, t.otherId, T0))
    expect(await run(t.storeId, (ctx) => grantAnniversaryPoints(ctx, S, T0))).toBe(1)
    expect(await run(t.storeId, (ctx) => grantAnniversaryPoints(ctx, S, T0))).toBe(0)
    expect(await balance(t, T0)).toBe(75)
  })

  it('a customer with an excluded tag, or anyone but test accounts while paused, earns nothing', async () => {
    const t = await seed()
    await rule(t, { type: 'daily_visit', points: 2 })
    await owner
      .update(customer)
      .set({ tags: ['wholesale'] })
      .where(eq(customer.id, t.customerId))
    const ex = settingsWith({ excludeTags: ['wholesale'] })
    expect((await run(t.storeId, (ctx) => recordVisit(ctx, t.customerId, ex, T0))).counted).toBe(
      false,
    )
    const paused = settingsWith({ programStatus: 'paused', testEmails: ['ravi@example.com'] })
    expect(
      (await run(t.storeId, (ctx) => recordVisit(ctx, t.customerId, paused, T0))).counted,
    ).toBe(false)
    expect((await run(t.storeId, (ctx) => recordVisit(ctx, t.otherId, paused, T0))).points).toBe(2)
  })
})

describe('order points settings', () => {
  it('counts shipping when asked, leaves GST out when asked, and skips excluded product tags', async () => {
    const t = await seed()
    const { orderId } = await deliveredOrder(t, 250_000, { taxPaise: 38_136 })
    const plan = (s: LoyaltySettings) =>
      run(t.storeId, (ctx) => planOrderPoints(ctx, orderId, s, T0))
    // Each plan is once per order: read the points by deleting between tries.
    const tryWith = async (s: LoyaltySettings) => {
      const r = await plan(s)
      await owner.delete(loyaltyEntry)
      return r?.points ?? 0
    }
    expect(await tryWith(S)).toBe(25)
    expect(await tryWith(settingsWith({ includeShipping: true }))).toBe(25) // ₹2,549 → 25
    expect(await tryWith(settingsWith({ includeTaxes: false }))).toBe(21) // ₹2,118.64
    await rule(t, { type: 'order_spend', points: 1, settings: { excludeProductTags: ['gift'] } })
    await owner.update(product).set({ tags: ['gift'] })
    expect(await tryWith(S)).toBe(0)
  })
})

describe('VIP tiers', () => {
  it('qualify by points earned, move up with history, tag, email, and multiply order points', async () => {
    const t = await seed()
    const bronze = await run(t.storeId, (ctx) =>
      saveTier(ctx, null, { name: 'Bronze', threshold: 0, customerTag: 'vip-bronze' }),
    )
    const gold = await run(t.storeId, (ctx) =>
      saveTier(ctx, null, {
        name: 'Gold',
        threshold: 100,
        multiplierBp: 15_000,
        customerTag: 'vip-gold',
        perks: ['Free gift wrap'],
      }),
    )
    await run(t.storeId, (ctx) => recalcTier(ctx, t.customerId, S, T0))
    const [m0] = await owner
      .select()
      .from(loyaltyMember)
      .where(eq(loyaltyMember.customerId, t.customerId))
    expect(m0?.tierId).toBe(bronze.id)
    await run(t.storeId, (ctx) =>
      addPoints(
        ctx,
        { customerId: t.customerId, points: 120, source: 'adjustment', reason: 'x' },
        S,
        T0,
      ),
    )
    const move = await run(t.storeId, (ctx) => recalcTier(ctx, t.customerId, S, T0))
    expect(move).toEqual({ changed: true, fromTierId: bronze.id, toTierId: gold.id })
    const [c] = await owner.select().from(customer).where(eq(customer.id, t.customerId))
    expect(c?.tags).toEqual(['vip-gold'])
    expect(await owner.select().from(loyaltyTierChange)).toHaveLength(2)
    const mails = await owner
      .select()
      .from(loyaltyNotification)
      .where(eq(loyaltyNotification.template, 'loyalty_tier_unlocked'))
    expect(mails.map((m) => m.dedupeKey).sort()).toEqual([`tier:${bronze.id}`, `tier:${gold.id}`])
    const { orderId } = await deliveredOrder(t, 250_000)
    const row = await earnOrder(t, orderId, at(30))
    expect(row).toMatchObject({ points: 37, multiplierBp: 15_000 }) // 25 × 1.5
    expect(await balance(t, at(30))).toBe(120 + 37)
  })

  it('qualify by money spent over the last 12 months, and slip down when it ages out', async () => {
    const t = await seed()
    const spend = settingsWith({ tierBasis: 'spend', tierWindow: 'rolling_12m' })
    const silver = await run(t.storeId, (ctx) =>
      saveTier(ctx, null, { name: 'Silver', threshold: 200_000 }),
    )
    await deliveredOrder(t, 250_000)
    expect(await run(t.storeId, (ctx) => tierValue(ctx, t.customerId, spend, T0))).toBe(254_900)
    expect((await run(t.storeId, (ctx) => recalcTier(ctx, t.customerId, spend, T0))).toTierId).toBe(
      silver.id,
    )
    const later = at(400)
    expect(await run(t.storeId, (ctx) => tierValue(ctx, t.customerId, spend, later))).toBe(0)
    expect(
      (await run(t.storeId, (ctx) => recalcTier(ctx, t.customerId, spend, later))).toTierId,
    ).toBeNull()
  })
})

describe('bonus campaigns', () => {
  it('2x on orders placed in the window (and only for its tiers), fixed bonus added; a cancel takes it all', async () => {
    const t = await seed()
    await run(t.storeId, (ctx) =>
      saveLoyaltyCampaign(ctx, null, {
        name: 'Diwali 2x',
        startsAt: at(-1),
        endsAt: at(1),
        bonusType: 'multiplier',
        multiplierBp: 20_000,
      }),
    )
    await run(t.storeId, (ctx) =>
      saveLoyaltyCampaign(ctx, null, {
        name: '+10',
        startsAt: at(-1),
        endsAt: at(1),
        bonusType: 'fixed',
        bonusPoints: 10,
      }),
    )
    const inside = await deliveredOrder(t, 250_000)
    const outside = await deliveredOrder(t, 250_000, { placedAt: at(2) })
    expect(
      (await run(t.storeId, (ctx) => planOrderPoints(ctx, inside.orderId, S, T0)))?.points,
    ).toBe(60)
    expect(
      (await run(t.storeId, (ctx) => planOrderPoints(ctx, outside.orderId, S, T0)))?.points,
    ).toBe(25)
    await owner.update(order).set({ status: 'cancelled' }).where(eq(order.id, inside.orderId))
    await run(t.storeId, (ctx) => reverseOrderPoints(ctx, inside.orderId, S, at(1)))
    const [e] = await owner
      .select()
      .from(loyaltyEntry)
      .where(and(eq(loyaltyEntry.orderId, inside.orderId)))
    expect(e?.status).toBe('cancelled')
  })
})

describe('expiry and emails', () => {
  it('records expired ledger-only points once, and queues one expiry email per window', async () => {
    const t = await seed()
    const off = settingsWith({ pointsAsStoreCredit: false, expiryMonths: 1 })
    await run(t.storeId, (ctx) =>
      addPoints(
        ctx,
        { customerId: t.customerId, points: 40, source: 'adjustment', reason: 'x' },
        off,
        T0,
      ),
    )
    expect(await run(t.storeId, (ctx) => queuePointsExpiryEmails(ctx, off, at(5)))).toBe(1)
    expect(await run(t.storeId, (ctx) => queuePointsExpiryEmails(ctx, off, at(6)))).toBe(0)
    expect(await run(t.storeId, (ctx) => queuePointsExpiryEmails(ctx, off, at(25)))).toBe(1)
    const keys = (await owner.select().from(loyaltyNotification))
      .map((n) => n.dedupeKey.split(':')[1])
      .sort()
    expect(keys).toEqual(['30', '7'])
    expect(await run(t.storeId, (ctx) => recordExpiredPoints(ctx, at(40)))).toBe(1)
    expect(await run(t.storeId, (ctx) => recordExpiredPoints(ctx, at(41)))).toBe(0)
    const [x] = await owner.select().from(loyaltyEntry).where(eq(loyaltyEntry.source, 'expiry'))
    expect(x?.points).toBe(-40)
    expect(await balance(t, at(41))).toBe(0)
  })
})
