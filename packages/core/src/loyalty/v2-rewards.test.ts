/** SOURCE OF TRUTH: loyalty reward redemption tests — WHAT: each reward type issues the right code or credit and takes the points, limits (total, once per customer, tier, points) hold under parallel redeems, ledger-only points pay for rewards first, and staff cancel an unused code for the points back / WHY: a redemption trades points for money off; it must happen exactly once and refund only when unused */
import {
  customer,
  discount,
  discountUsage,
  loyaltyEntry,
  loyaltyRedemption,
  order,
  storeCreditEntry,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { spendableStoreCredit } from '../customers/store-credit-expiry'
import { addPoints } from './balance'
import { app, at, owner, run, type Seed, seed, settingsWith, T0 } from './fixtures.test-util'
import { claimActionRule } from './grants'
import { pointsSummary } from './ledger'
import { cancelRedemption, expireRedemptions, markRedemptionsUsed, redeemReward } from './redeem'
import { saveReward } from './rewards'
import { saveEarnRule } from './rules'
import { shopperLoyalty } from './shopper'
import { recalcTier, saveTier } from './tiers'

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

beforeEach(async () => {
  await resetDb(owner)
})

const S = settingsWith()

const give = (t: Seed, points: number, s = S, customerId = t.customerId) =>
  run(t.storeId, (ctx) =>
    addPoints(ctx, { customerId, points, source: 'adjustment', reason: 'test' }, s, T0),
  )

const balance = (t: Seed, customerId = t.customerId, now = T0) =>
  run(t.storeId, async (ctx) => (await pointsSummary(ctx, customerId, 0, now)).points)

const reward = (t: Seed, input: Record<string, unknown>) =>
  run(t.storeId, (ctx) => saveReward(ctx, null, { title: 'Reward', ...input }, T0))

const redeem = (t: Seed, rewardId: string, points?: number, s = S, customerId = t.customerId) =>
  run(t.storeId, (ctx) => redeemReward(ctx, { customerId, rewardId, points }, s, T0))

const codeOf = async (id: string | null) => {
  if (!id) return null
  const [d] = await owner.select().from(discount).where(eq(discount.id, id))
  return d ?? null
}

describe('redeeming each reward type', () => {
  it('amount off: a one-use ₹ code only this customer can use, points taken', async () => {
    const t = await seed()
    await give(t, 500)
    const r = await reward(t, {
      type: 'amount_off',
      pointsCost: 200,
      value: 20_000,
      minOrderPaise: 100_000,
      codeDays: 30,
    })
    const red = await redeem(t, r.id)
    expect(red).toMatchObject({ status: 'issued', points: 200, rewardType: 'amount_off' })
    const d = await codeOf(red.discountId)
    expect(d).toMatchObject({
      type: 'order',
      method: 'fixed',
      value: 20_000,
      minSubtotalPaise: 100_000,
      usageLimit: 1,
      usagePerCustomer: 1,
      customerEligibility: 'customers',
      eligibleIds: [t.customerId],
      code: red.code,
    })
    expect(d?.endsAt?.getTime()).toBe(T0.getTime() + 30 * 86_400_000)
    expect(await balance(t)).toBe(300)
  })

  it('custom amount: the shopper picks whole steps; percent off; free shipping; free product', async () => {
    const t = await seed()
    await give(t, 2_000)
    const custom = await reward(t, {
      type: 'custom_amount_off',
      pointsCost: 100,
      value: 1_000,
      maxPoints: 1_000,
    })
    const c = await redeem(t, custom.id, 300)
    expect((await codeOf(c.discountId))?.value).toBe(3_000)
    await expect(redeem(t, custom.id, 250)).rejects.toMatchObject({ reason: 'invalid' })
    const pct = await redeem(
      t,
      (await reward(t, { type: 'percent_off', pointsCost: 100, value: 1_000 })).id,
    )
    expect(await codeOf(pct.discountId)).toMatchObject({
      type: 'order',
      method: 'percent',
      value: 1_000,
    })
    const ship = await redeem(t, (await reward(t, { type: 'free_shipping', pointsCost: 100 })).id)
    expect(await codeOf(ship.discountId)).toMatchObject({
      type: 'shipping',
      method: 'free_shipping',
    })
    const free = await redeem(
      t,
      (await reward(t, { type: 'free_product', pointsCost: 100, productId: t.productId })).id,
    )
    expect(await codeOf(free.discountId)).toMatchObject({
      type: 'bxgy',
      method: 'percent',
      value: 10_000,
      bxgy: { gets: { quantity: 1, ids: [t.productId] }, maxUsesPerOrder: 1 },
    })
    expect(await balance(t)).toBe(2_000 - 300 - 300)
  })

  it('store credit: credit lands at once, no code, the redemption is used', async () => {
    const t = await seed()
    await give(t, 500)
    const r = await reward(t, { type: 'store_credit', pointsCost: 400, value: 50_000 })
    const red = await redeem(t, r.id)
    expect(red).toMatchObject({ status: 'used', code: null, discountId: null })
    const [line] = await owner
      .select()
      .from(storeCreditEntry)
      .where(eq(storeCreditEntry.id, red.storeCreditEntryId as string))
    expect(line).toMatchObject({ kind: 'adjustment', amountPaise: 50_000 })
    // 100 points left + ₹500 credit = ₹600 spendable; the credit is not counted as points.
    expect(await balance(t)).toBe(100)
    expect(await run(t.storeId, (ctx) => spendableStoreCredit(ctx, t.customerId, T0))).toBe(60_000)
  })
})

describe('limits', () => {
  it('refuses with too few points, below the tier, and once per customer', async () => {
    const t = await seed()
    await give(t, 150)
    const big = await reward(t, { type: 'amount_off', pointsCost: 200, value: 100 })
    await expect(redeem(t, big.id)).rejects.toMatchObject({ reason: 'insufficient' })
    const gold = await run(t.storeId, (ctx) =>
      saveTier(ctx, null, { name: 'Gold', threshold: 1_000 }),
    )
    const vip = await reward(t, {
      type: 'amount_off',
      pointsCost: 10,
      value: 100,
      minTierId: gold.id,
    })
    await expect(redeem(t, vip.id)).rejects.toMatchObject({ reason: 'not_eligible' })
    await give(t, 1_000)
    await run(t.storeId, (ctx) => recalcTier(ctx, t.customerId, S, T0))
    expect((await redeem(t, vip.id)).status).toBe('issued')
    const once = await reward(t, {
      type: 'amount_off',
      pointsCost: 10,
      value: 100,
      oncePerCustomer: true,
    })
    await redeem(t, once.id)
    await expect(redeem(t, once.id)).rejects.toMatchObject({ reason: 'limit_reached' })
  })

  it('a total limit of 3 holds across 6 parallel redeems', async () => {
    const t = await seed()
    await give(t, 1_000)
    const r = await reward(t, { type: 'amount_off', pointsCost: 10, value: 100, usageLimit: 3 })
    const results = await Promise.allSettled(Array.from({ length: 6 }, () => redeem(t, r.id)))
    expect(results.filter((x) => x.status === 'fulfilled')).toHaveLength(3)
    expect(await balance(t)).toBe(970)
  })

  it('parallel redeems never spend more points than held', async () => {
    const t = await seed()
    await give(t, 250)
    const r = await reward(t, { type: 'amount_off', pointsCost: 100, value: 100 })
    const results = await Promise.allSettled(Array.from({ length: 5 }, () => redeem(t, r.id)))
    expect(results.filter((x) => x.status === 'fulfilled')).toHaveLength(2)
    expect(await balance(t)).toBe(50)
  })
})

describe('points in the ledger only', () => {
  it('with "spend as store credit" off, points never reach the balance and still buy rewards', async () => {
    const t = await seed()
    const off = settingsWith({ pointsAsStoreCredit: false })
    await give(t, 300, off)
    expect(await run(t.storeId, (ctx) => spendableStoreCredit(ctx, t.customerId, T0))).toBe(0)
    expect(await balance(t)).toBe(300)
    const r = await reward(t, { type: 'amount_off', pointsCost: 120, value: 100 })
    await redeem(t, r.id, undefined, off)
    expect(await balance(t)).toBe(180)
    const rows = await owner
      .select()
      .from(loyaltyEntry)
      .where(eq(loyaltyEntry.source, 'redemption'))
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ points: -120, storeCreditEntryId: null })
  })

  it('ledger-only points are spent before store credit points', async () => {
    const t = await seed()
    await give(t, 100)
    await give(t, 50, settingsWith({ pointsAsStoreCredit: false }))
    const r = await reward(t, { type: 'amount_off', pointsCost: 80, value: 100 })
    await redeem(t, r.id)
    const rows = await owner
      .select()
      .from(loyaltyEntry)
      .where(eq(loyaltyEntry.source, 'redemption'))
    expect(rows.map((x) => x.points).sort()).toEqual([-30, -50])
    expect(await balance(t)).toBe(70)
    expect(await run(t.storeId, (ctx) => spendableStoreCredit(ctx, t.customerId, T0))).toBe(7_000)
  })
})

describe('after redeeming', () => {
  it('staff cancel an unused code: code off, points back; a used code is refused', async () => {
    const t = await seed()
    await give(t, 500)
    const r = await reward(t, { type: 'amount_off', pointsCost: 200, value: 100, usageLimit: 1 })
    const red = await redeem(t, r.id)
    const done = await run(t.storeId, (ctx) =>
      cancelRedemption(ctx, red.id, 'staff@w.in', S, at(1)),
    )
    expect(done.status).toBe('cancelled')
    expect((await codeOf(red.discountId))?.status).toBe('disabled')
    expect(await balance(t, t.customerId, at(1))).toBe(500)
    // The usage count came back too, so the limit of 1 lets it be taken again.
    const again = await redeem(t, r.id)
    const [o] = await owner
      .insert(order)
      .values({
        storeId: t.storeId,
        number: 1,
        status: 'open',
        subtotalPaise: 1,
        totalPaise: 1,
        customerId: t.customerId,
      })
      .returning()
    await owner.insert(discountUsage).values({
      storeId: t.storeId,
      discountId: again.discountId as string,
      orderId: o?.id as string,
      customerId: t.customerId,
      amountPaise: 100,
    })
    expect(await run(t.storeId, (ctx) => markRedemptionsUsed(ctx, o?.id as string))).toBe(1)
    await expect(
      run(t.storeId, (ctx) => cancelRedemption(ctx, again.id, null, S, at(1))),
    ).rejects.toMatchObject({ reason: 'used' })
  })

  it('unused codes past their end expire, and can still be cancelled for the points', async () => {
    const t = await seed()
    await give(t, 100)
    const r = await reward(t, { type: 'percent_off', pointsCost: 100, value: 500, codeDays: 3 })
    const red = await redeem(t, r.id)
    expect(await run(t.storeId, (ctx) => expireRedemptions(ctx, at(2)))).toBe(0)
    expect(await run(t.storeId, (ctx) => expireRedemptions(ctx, at(4)))).toBe(1)
    const [row] = await owner
      .select()
      .from(loyaltyRedemption)
      .where(eq(loyaltyRedemption.id, red.id))
    expect(row?.status).toBe('expired')
    await run(t.storeId, (ctx) => cancelRedemption(ctx, red.id, null, S, at(5)))
    expect(await balance(t, t.customerId, at(5))).toBe(100)
  })

  it('an excluded customer cannot redeem', async () => {
    const t = await seed()
    await give(t, 100)
    const r = await reward(t, { type: 'amount_off', pointsCost: 10, value: 100 })
    await owner.update(customer).set({ tags: ['staff'] })
    await expect(
      redeem(t, r.id, undefined, settingsWith({ excludeTags: ['staff'] })),
    ).rejects.toMatchObject({ reason: 'not_eligible' })
  })
})

describe('the shopper’s view', () => {
  it('shows points, rewards with why one is blocked, codes, and claimed once-only rules', async () => {
    const t = await seed()
    await give(t, 250)
    const cheap = await reward(t, { type: 'amount_off', pointsCost: 100, value: 100 })
    await reward(t, { type: 'amount_off', pointsCost: 500, value: 500 })
    await redeem(t, cheap.id)
    await run(t.storeId, (ctx) =>
      saveEarnRule(ctx, null, {
        type: 'social',
        key: 'instagram',
        points: 5,
        settings: { url: 'https://instagram.com/w' },
      }),
    )
    const rule = await run(t.storeId, (ctx) =>
      saveEarnRule(ctx, null, {
        type: 'google_review',
        points: 5,
        settings: { url: 'https://g.page/w' },
      }),
    )
    await run(t.storeId, (ctx) => claimActionRule(ctx, t.customerId, rule.id, S, T0))
    const view = await run(t.storeId, (ctx) => shopperLoyalty(ctx, t.customerId, S, T0))
    if (!view.open) throw new Error('closed')
    expect(view.summary.points).toBe(155)
    expect(view.rewards.map((r) => r.block)).toEqual([null, 'points'])
    expect(view.redemptions).toHaveLength(1)
    expect(view.waysToEarn.map((w) => [w.type, w.claimed])).toEqual([
      ['social', false],
      ['google_review', true],
    ])
    const closed = await run(t.storeId, (ctx) =>
      shopperLoyalty(ctx, t.customerId, settingsWith({ programStatus: 'paused' }), T0),
    )
    expect(closed.open).toBe(false)
  })
})
