/** SOURCE OF TRUTH: the storefront's loyalty view — WHAT: everything the shopper's loyalty widget and account page show in one read (points in the store's name, tier and progress, rewards with whether each can be taken and why not, their codes, ways to earn with what they already claimed, their referral code) and the signed-out program summary / WHY: the storefront widgets read one shape, never staff-only fields (reasons, staff emails, rejected referral reasons) */
import { loyaltyEntry, loyaltyRedemption } from '@commerce/db'
import { and, desc, eq, isNotNull, ne } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { pointsSummary } from './ledger'
import { canUseProgram, ensureMember } from './member'
import { referralSummary } from './referrals'
import { listRewards, type RewardBlock, type RewardRow, rewardBlock, rewardPrice } from './rewards'
import { type EarnRuleRow, listEarnRules } from './rules'
import { ONCE_ONLY_RULES, parseRuleSettings } from './schemas'
import type { LoyaltySettings } from './settings'
import { listTiers, type TierRow, tierProgress } from './tiers'

export type PublicReward = Pick<
  RewardRow,
  | 'id'
  | 'type'
  | 'title'
  | 'description'
  | 'pointsCost'
  | 'value'
  | 'minPoints'
  | 'maxPoints'
  | 'productId'
  | 'variantId'
  | 'minOrderPaise'
  | 'minTierId'
>

export type PublicTier = Pick<
  TierRow,
  'id' | 'name' | 'threshold' | 'multiplierBp' | 'perks' | 'colors'
>

export type WayToEarn = {
  id: string
  type: EarnRuleRow['type']
  key: string
  title: string | null
  points: number
  /** Social and Google review rules: the link the button opens. */
  url: string | null
  /** For `visit_streak`: days in a row. */
  streakDays: number | null
  onceOnly: boolean
}

const publicReward = (r: RewardRow): PublicReward => ({
  id: r.id,
  type: r.type,
  title: r.title,
  description: r.description,
  pointsCost: r.pointsCost,
  value: r.value,
  minPoints: r.minPoints,
  maxPoints: r.maxPoints,
  productId: r.productId,
  variantId: r.variantId,
  minOrderPaise: r.minOrderPaise,
  minTierId: r.minTierId,
})

const publicTier = (t: TierRow): PublicTier => ({
  id: t.id,
  name: t.name,
  threshold: t.threshold,
  multiplierBp: t.multiplierBp,
  perks: t.perks,
  colors: t.colors,
})

function wayToEarn(r: EarnRuleRow): WayToEarn {
  const url =
    r.type === 'social'
      ? parseRuleSettings('social', r.settings).url
      : r.type === 'google_review'
        ? parseRuleSettings('google_review', r.settings).url
        : null
  return {
    id: r.id,
    type: r.type,
    key: r.key,
    title: r.title,
    points: r.points,
    url,
    streakDays:
      r.type === 'visit_streak' ? parseRuleSettings('visit_streak', r.settings).days : null,
    onceOnly: ONCE_ONLY_RULES.includes(r.type),
  }
}

/** The program for a signed-out visitor: names, ways to earn, rewards, tiers, both referral rewards (the widget's Give / Get card). */
export async function publicLoyaltyProgram(ctx: StoreContext, settings: LoyaltySettings) {
  const rules = (await listEarnRules(ctx)).filter((r) => r.enabled && r.points > 0)
  return {
    live: settings.programStatus === 'live',
    pointsName: { singular: settings.pointsNameSingular, plural: settings.pointsNamePlural },
    pointsAsStoreCredit: settings.pointsAsStoreCredit,
    waysToEarn: rules.map(wayToEarn),
    rewards: (await listRewards(ctx, { activeOnly: true }))
      .filter((r) => r.pointsCost > 0)
      .map(publicReward),
    tiers: (await listTiers(ctx)).map(publicTier),
    referral: settings.referrals.enabled
      ? {
          friendReward: settings.referrals.friendReward,
          referrerReward: settings.referrals.referrerReward,
        }
      : null,
  }
}

/**
 * The signed-in shopper's loyalty: everything the widget and the account page show. `open` is
 * false (and the rest empty) for a customer outside the program (excluded tag, paused).
 */
export async function shopperLoyalty(
  ctx: StoreContext,
  customerId: string,
  settings: LoyaltySettings,
  now: Date = new Date(),
) {
  const program = await publicLoyaltyProgram(ctx, settings)
  if (!(await canUseProgram(ctx, customerId, settings))) {
    return { open: false as const, program }
  }
  const member = await ensureMember(ctx, customerId, now)
  const summary = await pointsSummary(ctx, customerId, 30, now)
  const rewards = await listRewards(ctx, { activeOnly: true })
  const offered: (PublicReward & { block: RewardBlock | null })[] = []
  for (const r of rewards.filter((x) => x.pointsCost > 0)) {
    const price = rewardPrice(
      r,
      r.type === 'custom_amount_off' ? (r.minPoints ?? r.pointsCost) : null,
    )
    const block = await rewardBlock(
      ctx,
      r,
      { customerId, tierId: member.tierId, points: summary.points },
      price?.cost ?? r.pointsCost,
    )
    offered.push({ ...publicReward(r), block })
  }
  const claimed = await ctx.tx
    .select({ key: loyaltyEntry.earnKey })
    .from(loyaltyEntry)
    .where(
      and(
        eq(loyaltyEntry.customerId, customerId),
        isNotNull(loyaltyEntry.earnKey),
        ne(loyaltyEntry.status, 'cancelled'),
      ),
    )
  const keys = new Set(claimed.map((c) => c.key))
  const codes = await ctx.tx
    .select({
      id: loyaltyRedemption.id,
      title: loyaltyRedemption.title,
      rewardType: loyaltyRedemption.rewardType,
      points: loyaltyRedemption.points,
      code: loyaltyRedemption.code,
      status: loyaltyRedemption.status,
      expiresAt: loyaltyRedemption.expiresAt,
      createdAt: loyaltyRedemption.createdAt,
    })
    .from(loyaltyRedemption)
    .where(eq(loyaltyRedemption.customerId, customerId))
    .orderBy(desc(loyaltyRedemption.createdAt))
    .limit(50)
  const referral = settings.referrals.enabled ? await referralSummary(ctx, customerId, now) : null
  return {
    open: true as const,
    program,
    summary,
    tier: await tierProgress(ctx, customerId, settings, now),
    streakDays: member.streakDays,
    rewards: offered,
    redemptions: codes,
    waysToEarn: program.waysToEarn.map((w) => ({
      ...w,
      claimed: w.onceOnly && keys.has(w.type === 'social' ? `social:${w.key}` : w.type),
    })),
    referral: referral
      ? {
          code: referral.code,
          path: referral.path,
          completed: referral.completed,
          friendReward: settings.referrals.friendReward,
          referrerReward: settings.referrals.referrerReward,
        }
      : null,
  }
}
