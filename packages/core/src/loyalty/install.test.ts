/** SOURCE OF TRUTH: Loyalty first-install tests — WHAT: a new install gets referrals on, the earning rules and the starter rewards; a reinstall keeps the merchant's own / WHY: a fresh program's widget showed no rewards and no referral card */
import { resetDb } from '@commerce/db/test'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { app, owner, run, seed } from './fixtures.test-util'
import { STARTER_REWARDS, seedLoyaltyOnInstall } from './install'
import { listRewards, saveReward } from './rewards'
import { listEarnRules } from './rules'
import { defaultLoyaltySettings } from './settings'
import { loyaltyState, saveLoyaltySettings } from './state'

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

beforeEach(async () => {
  await resetDb(owner)
})

describe('Loyalty first install', () => {
  it('starts with referrals on, the agreed rates, earning rules and two rewards', async () => {
    const t = await seed()
    const done = await run(t.storeId, (ctx) => seedLoyaltyOnInstall(ctx))
    expect(done).toEqual({ settings: true, rewards: STARTER_REWARDS.length })
    const { settings } = await run(t.storeId, (ctx) => loyaltyState(ctx.tx, ctx.storeId))
    expect(settings.referrals.enabled).toBe(true)
    expect(settings).toMatchObject({
      pointsPer100: 1,
      expiryMonths: 12,
      reviewPoints: 25,
      birthdayPoints: 100,
    })
    const rewards = await run(t.storeId, (ctx) => listRewards(ctx))
    expect(rewards.map((r) => r.type)).toEqual(['amount_off', 'free_shipping'])
    const rules = await run(t.storeId, (ctx) => listEarnRules(ctx))
    expect(rules.map((r) => r.type).sort()).toEqual(['birthday', 'order_spend', 'product_review'])

    // Installing again adds nothing.
    expect(await run(t.storeId, (ctx) => seedLoyaltyOnInstall(ctx))).toEqual({
      settings: false,
      rewards: 0,
    })
    expect(await run(t.storeId, (ctx) => listRewards(ctx))).toHaveLength(2)
  })

  it('keeps a reinstalling store’s own settings and rewards', async () => {
    const t = await seed()
    await run(t.storeId, async (ctx) => {
      await saveLoyaltySettings(ctx.tx, ctx.storeId, { ...defaultLoyaltySettings, pointsPer100: 3 })
      await saveReward(ctx, null, { type: 'free_shipping', title: 'Ship free', pointsCost: 10 })
    })
    expect(await run(t.storeId, (ctx) => seedLoyaltyOnInstall(ctx))).toEqual({
      settings: false,
      rewards: 0,
    })
    const { settings } = await run(t.storeId, (ctx) => loyaltyState(ctx.tx, ctx.storeId))
    expect(settings.pointsPer100).toBe(3)
    expect(settings.referrals.enabled).toBe(false)
    expect(await run(t.storeId, (ctx) => listRewards(ctx))).toHaveLength(1)
  })
})
