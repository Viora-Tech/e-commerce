/** SOURCE OF TRUTH: the Loyalty points app's first install — WHAT: what a store starts with when it installs the app (referrals on, the earning rules, two rewards) / WHY: a freshly installed program showed a near-empty widget (no rewards to redeem, no referral card); a reinstall keeps whatever the merchant already set */
import { loyaltyReward, store } from '@commerce/db'
import { eq, sql } from 'drizzle-orm'
import { parseAppsSettings } from '../apps/settings'
import type { StoreContext } from '../context'
import { saveReward } from './rewards'
import { ensureEarnRules } from './rules'
import { defaultLoyaltySettings, LOYALTY_APP_ID, parseLoyaltySettings } from './settings'
import { saveLoyaltySettings } from './state'

/**
 * The rewards a new program starts with. Points are worth ₹1 each as store credit
 * (`POINT_PAISE`), so ₹50 off costs 50 points; both need a ₹499 order so a reward never pays
 * for a whole small order. The merchant changes or removes them on the Program page.
 */
export const STARTER_REWARDS = [
  {
    type: 'amount_off' as const,
    title: '₹50 off your order',
    pointsCost: 50,
    value: 5_000,
    minOrderPaise: 49_900,
    position: 0,
  },
  {
    type: 'free_shipping' as const,
    title: 'Free shipping',
    pointsCost: 75,
    value: 0,
    minOrderPaise: 49_900,
    position: 1,
  },
]

/**
 * Runs when the store installs Loyalty points. A store that never saved the app's settings gets
 * the owner's defaults (16 Nov 2026: 1 point per ₹100, 12-month expiry, 25 for a review, 100 on
 * the birthday, no tiers) with referrals switched on (the member gets 100 points, the friend
 * 10% off); the earning rules are made from them; a store with no rewards gets
 * `STARTER_REWARDS`. Anything the store already has is left as it is (a reinstall).
 */
export async function seedLoyaltyOnInstall(
  ctx: StoreContext,
  now: Date = new Date(),
): Promise<{ settings: boolean; rewards: number }> {
  const [s] = await ctx.tx.select({ apps: store.apps }).from(store).where(eq(store.id, ctx.storeId))
  const saved = parseAppsSettings(s?.apps).settings?.[LOYALTY_APP_ID]
  const fresh = saved === undefined
  const settings = fresh
    ? await saveLoyaltySettings(ctx.tx, ctx.storeId, {
        ...defaultLoyaltySettings,
        referrals: { ...defaultLoyaltySettings.referrals, enabled: true },
      })
    : parseLoyaltySettings(saved)
  await ensureEarnRules(ctx, settings, now)
  const [has] = await ctx.tx
    .select({ n: sql<number>`count(*)::int` })
    .from(loyaltyReward)
    .where(eq(loyaltyReward.storeId, ctx.storeId))
  let rewards = 0
  if ((has?.n ?? 0) === 0) {
    for (const r of STARTER_REWARDS) {
      await saveReward(ctx, null, r, now)
      rewards += 1
    }
  }
  return { settings: fresh, rewards }
}
