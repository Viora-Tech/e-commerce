/** SOURCE OF TRUTH: loyalty members, bulk points and analytics tests — WHAT: the members list (search, tier and status filters, points, lifetime points, spent), CSV export and import (set and add), reset all, the activity feed and the analytics figures over a range / WHY: bulk tools move many balances at once and the analytics drive the merchant's decisions, so each number is pinned */
import { customer, discountUsage, loyaltyEntry } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { loyaltyActivity, loyaltyAnalytics } from './analytics'
import { addPoints } from './balance'
import {
  app,
  at,
  deliveredOrder,
  owner,
  run,
  type Seed,
  seed,
  settingsWith,
  T0,
} from './fixtures.test-util'
import { pointsSummary } from './ledger'
import { ensureMember } from './member'
import {
  exportMembersCsv,
  importPointBalances,
  listLoyaltyMembers,
  parsePointsCsv,
  resetAllPoints,
} from './members'
import { redeemReward } from './redeem'
import { saveReward } from './rewards'
import { recalcTier, saveTier } from './tiers'

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

beforeEach(async () => {
  await resetDb(owner)
})

const S = settingsWith({ excludeTags: ['staff'] })

const give = (t: Seed, customerId: string, points: number, now = T0) =>
  run(t.storeId, (ctx) =>
    addPoints(ctx, { customerId, points, source: 'adjustment', reason: 'x' }, S, now),
  )

const balance = (t: Seed, customerId: string) =>
  run(t.storeId, async (ctx) => (await pointsSummary(ctx, customerId, 0, at(1))).points)

describe('members list', () => {
  it('lists members with tier, points, lifetime points and spent; filters by search, tier and status', async () => {
    const t = await seed()
    const gold = await run(t.storeId, (ctx) =>
      saveTier(ctx, null, { name: 'Gold', threshold: 100 }),
    )
    await give(t, t.customerId, 150)
    await give(t, t.otherId, 20)
    await run(t.storeId, (ctx) => recalcTier(ctx, t.customerId, S, T0))
    await deliveredOrder(t, 100_000)
    await owner
      .update(customer)
      .set({ tags: ['staff'] })
      .where(eq(customer.id, t.otherId))
    const list = (input: Parameters<typeof listLoyaltyMembers>[1]) =>
      run(t.storeId, (ctx) => listLoyaltyMembers(ctx, input, S, at(1)))
    const all = await list({ sort: 'lifetime_points', dir: 'desc' })
    expect(all.total).toBe(2)
    expect(all.rows[0]).toMatchObject({
      name: 'Asha',
      status: 'active',
      tierId: gold.id,
      tierName: 'Gold',
      points: 150,
      lifetimePoints: 150,
      totalSpentPaise: 104_900,
    })
    expect(all.rows[1]).toMatchObject({ name: 'Ravi', status: 'excluded', points: 20 })
    expect((await list({ search: 'ravi' })).rows.map((r) => r.name)).toEqual(['Ravi'])
    expect((await list({ tierId: gold.id })).rows.map((r) => r.name)).toEqual(['Asha'])
    expect((await list({ tierId: 'none' })).rows.map((r) => r.name)).toEqual(['Ravi'])
    expect((await list({ status: 'excluded' })).total).toBe(1)
  })
})

describe('export, import and reset', () => {
  it('exports CSV, imports balances by set and add, and resets everyone to 0', async () => {
    const t = await seed()
    await give(t, t.customerId, 100)
    await run(t.storeId, (ctx) => ensureMember(ctx, t.otherId, T0))
    const csv = await run(t.storeId, (ctx) => exportMembersCsv(ctx, S, at(1)))
    expect(csv.split('\n')[0]).toBe('email,name,status,tier,points,lifetime_points,total_spent')
    expect(csv).toContain('asha@example.com,Asha,active,,100,100,0.00')
    const file = parsePointsCsv(
      'email,points\nasha@example.com,40\nravi@example.com,25\nnobody@example.com,5\n',
    )
    const set = await run(t.storeId, (ctx) =>
      importPointBalances(
        ctx,
        { rows: file.rows, mode: 'set', staffEmail: 'staff@w.in' },
        S,
        at(1),
      ),
    )
    expect(set).toEqual({
      updated: 2,
      unchanged: 0,
      skipped: [{ email: 'nobody@example.com', reason: 'No customer with this email' }],
    })
    expect(await balance(t, t.customerId)).toBe(40)
    expect(await balance(t, t.otherId)).toBe(25)
    await run(t.storeId, (ctx) =>
      importPointBalances(
        ctx,
        { rows: [{ email: 'asha@example.com', points: 10 }], mode: 'add', staffEmail: null },
        S,
        at(1),
      ),
    )
    expect(await balance(t, t.customerId)).toBe(50)
    const imports = await owner.select().from(loyaltyEntry).where(eq(loyaltyEntry.source, 'import'))
    expect(imports.map((e) => e.points).sort((a, b) => a - b)).toEqual([-60, 10, 25])
    expect(await run(t.storeId, (ctx) => resetAllPoints(ctx, 'staff@w.in', at(1)))).toEqual({
      members: 2,
      points: 75,
    })
    expect(await balance(t, t.customerId)).toBe(0)
    expect(await balance(t, t.otherId)).toBe(0)
  })
})

describe('activity and analytics', () => {
  it('feeds points moves and tier changes newest first', async () => {
    const t = await seed()
    await run(t.storeId, (ctx) => saveTier(ctx, null, { name: 'Gold', threshold: 10 }))
    await give(t, t.customerId, 15, T0)
    await run(t.storeId, (ctx) => recalcTier(ctx, t.customerId, S, at(1)))
    const items = await run(t.storeId, (ctx) => loyaltyActivity(ctx, { limit: 10 }))
    expect(items.map((i) => i.kind)).toEqual(['tier', 'points'])
    expect(
      await run(t.storeId, (ctx) => loyaltyActivity(ctx, { before: at(1), limit: 10 })),
    ).toHaveLength(1)
  })

  it('counts member revenue, orders with rewards, points issued, redeemed, expired and members over a range', async () => {
    const t = await seed()
    await run(t.storeId, (ctx) => ensureMember(ctx, t.customerId, at(-10)))
    await give(t, t.customerId, 400, at(-5))
    const r = await run(t.storeId, (ctx) =>
      saveReward(ctx, null, { type: 'amount_off', title: '₹100', pointsCost: 100, value: 10_000 }),
    )
    const red = await run(t.storeId, (ctx) =>
      redeemReward(ctx, { customerId: t.customerId, rewardId: r.id }, S, at(-4)),
    )
    const o = await deliveredOrder(t, 200_000, { placedAt: at(-3) })
    await deliveredOrder(t, 100_000, { placedAt: at(-2), status: 'cancelled' })
    await deliveredOrder(t, 100_000, { placedAt: at(-2), customerId: t.otherId })
    await owner.insert(discountUsage).values({
      storeId: t.storeId,
      discountId: red.discountId as string,
      orderId: o.orderId,
      customerId: t.customerId,
      amountPaise: 10_000,
    })
    const a = await run(t.storeId, (ctx) => loyaltyAnalytics(ctx, { from: at(-10), to: T0 }))
    expect(a).toMatchObject({
      memberRevenuePaise: 204_900,
      memberOrders: 1,
      ordersWithRewards: 1,
      pointsIssued: 400,
      pointsRedeemed: 100,
      pointsExpired: 0,
      redemptionRate: 0.25,
      activeMembers: 1,
      newMembers: 1,
      redemptions: 1,
    })
    const before = await run(t.storeId, (ctx) =>
      loyaltyAnalytics(ctx, { from: at(-30), to: at(-11) }),
    )
    expect(before).toMatchObject({
      pointsIssued: 0,
      memberOrders: 0,
      newMembers: 0,
      redemptionRate: 0,
    })
  })
})
