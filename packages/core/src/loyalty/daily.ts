/** SOURCE OF TRUTH: the loyalty v2 sweep steps — WHAT: per store, what the worker's hourly loyalty sweep runs besides crediting due points: making v1 stores' rules, anniversary points, completing referrals past their hold, recording expired points, expiring unused reward codes, queueing the expiry emails, and the nightly tier recalculation / WHY: every step is idempotent and batched, so the hourly run doubles as the nightly one (tiers once per store-time day) */
import { dayKey } from '@commerce/dates'
import type { StoreContext } from '../context'
import { storeCreditTimeZone } from '../customers/store-credit-expiry'
import { recordExpiredPoints } from './expiry'
import { grantAnniversaryPoints } from './grants'
import { queuePointsExpiryEmails, queueRewardExpiryEmails } from './notify'
import { expireRedemptions } from './redeem'
import { completeDueReferrals } from './referrals'
import { ensureEarnRules } from './rules'
import type { LoyaltySettings } from './settings'
import { recalcTiersBatch } from './tiers'

export type LoyaltyDailyCounts = {
  rulesMade: boolean
  anniversaries: number
  referralsCompleted: number
  expiredEntries: number
  codesExpired: number
  emailsQueued: number
  tiersMoved: number
}

/** One store's v2 sweep steps, in the caller's transaction. */
export async function runLoyaltySweepSteps(
  ctx: StoreContext,
  settings: LoyaltySettings,
  now: Date = new Date(),
): Promise<LoyaltyDailyCounts> {
  const rulesMade = await ensureEarnRules(ctx, settings, now)
  const anniversaries = await grantAnniversaryPoints(ctx, settings, now)
  const referralsCompleted = await completeDueReferrals(ctx, settings, now)
  const expiredEntries = await recordExpiredPoints(ctx, now)
  const codesExpired = await expireRedemptions(ctx, now)
  const emailsQueued =
    (await queuePointsExpiryEmails(ctx, settings, now)) + (await queueRewardExpiryEmails(ctx, now))
  const day = dayKey(now, await storeCreditTimeZone(ctx))
  const tiersMoved = await recalcTiersBatch(ctx, settings, day, now)
  return {
    rulesMade,
    anniversaries,
    referralsCompleted,
    expiredEntries,
    codesExpired,
    emailsQueued,
    tiersMoved,
  }
}
