/**
 * Loyalty points v2, program setup (`loyalty.rules.*`, `loyalty.rewards.*`,
 * `loyalty.redemptions.*`, `loyalty.tiers.*`, `loyalty.campaigns.*`): earning rules, the rewards
 * catalog and the codes members took, VIP tiers and bonus campaigns. Redeeming or cancelling
 * moves points, which can be money: through MCP they wait for a person (`SENSITIVE_PATHS`).
 */
import {
  cancelRedemption,
  deleteEarnRule,
  deleteLoyaltyCampaign,
  deleteReward,
  deleteTier,
  EarnRuleInputSchema,
  ensureEarnRules,
  LOYALTY_REDEMPTION_STATUSES,
  LoyaltyCampaignInputSchema,
  listEarnRules,
  listLoyaltyCampaigns,
  listRedemptions,
  listRewards,
  listTiers,
  permissions,
  RewardInputSchema,
  recalcTier,
  redeemReward,
  saveEarnRule,
  saveLoyaltyCampaign,
  saveReward,
  saveTier,
  TierInputSchema,
} from '@commerce/core'
import { z } from 'zod'
import { can, PAGE_MAX, PAGE_SIZE_MAX } from '../procedures'
import { ctxOf, requireInstalled, surface } from './loyalty-common'

const byId = z.object({ id: z.uuid() })

export const loyaltyRulesRouter = {
  /** The store's earning rules in order; a v1 store gets its rules made from its v1 numbers first. */
  list: can(permissions.SETTINGS_READ).handler(async ({ context }) => {
    const settings = await requireInstalled(context)
    await ensureEarnRules(ctxOf(context), settings)
    return listEarnRules(ctxOf(context))
  }),
  /** Add an earning rule (no id) or change one. */
  save: can(permissions.SETTINGS_MANAGE)
    .input(z.object({ id: z.uuid().nullable().default(null), rule: EarnRuleInputSchema }))
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      return surface(() => saveEarnRule(ctxOf(context), input.id, input.rule))
    }),
  /** Remove an earning rule; points it gave stay. */
  remove: can(permissions.SETTINGS_MANAGE)
    .input(byId)
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      await surface(() => deleteEarnRule(ctxOf(context), input.id))
      return { ok: true as const }
    }),
}

export const loyaltyRewardsRouter = {
  /** The rewards catalog in order, inactive ones included. */
  list: can(permissions.SETTINGS_READ).handler(async ({ context }) => {
    await requireInstalled(context)
    return listRewards(ctxOf(context))
  }),
  /** Add a reward (no id) or change one; codes already issued keep their terms. */
  save: can(permissions.SETTINGS_MANAGE)
    .input(z.object({ id: z.uuid().nullable().default(null), reward: RewardInputSchema }))
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      return surface(() => saveReward(ctxOf(context), input.id, input.reward))
    }),
  /** Remove a reward never redeemed, or switch off one that was. */
  remove: can(permissions.SETTINGS_MANAGE)
    .input(byId)
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      return { result: await surface(() => deleteReward(ctxOf(context), input.id)) }
    }),
}

export const loyaltyRedemptionsRouter = {
  /** Rewards members took, newest first: one customer's or the store's, by status. */
  list: can(permissions.CUSTOMERS_READ)
    .input(
      z.object({
        customerId: z.uuid().optional(),
        status: z.enum(LOYALTY_REDEMPTION_STATUSES).optional(),
        page: z.number().int().min(1).max(PAGE_MAX).default(1),
        perPage: z.number().int().min(1).max(PAGE_SIZE_MAX).default(25),
      }),
    )
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      return listRedemptions(ctxOf(context), input)
    }),
  /** Redeem a reward for a customer (staff, e.g. on the phone): takes their points, issues the code. */
  redeemFor: can(permissions.CUSTOMERS_WRITE)
    .input(
      z.object({
        customerId: z.uuid(),
        rewardId: z.uuid(),
        points: z.number().int().min(1).max(10_000_000).optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const settings = await requireInstalled(context)
      return surface(() => redeemReward(ctxOf(context), input, settings))
    }),
  /** Cancel an unused reward code: the code stops working and the points come back. */
  cancel: can(permissions.CUSTOMERS_WRITE)
    .input(byId)
    .handler(async ({ context, input }) => {
      const settings = await requireInstalled(context)
      return surface(() =>
        cancelRedemption(ctxOf(context), input.id, context.session.user.email, settings),
      )
    }),
}

export const loyaltyTiersRouter = {
  /** VIP tiers, lowest first. */
  list: can(permissions.SETTINGS_READ).handler(async ({ context }) => {
    await requireInstalled(context)
    return listTiers(ctxOf(context))
  }),
  /** Add a tier (no id) or change one; members move on their next recalculation. */
  save: can(permissions.SETTINGS_MANAGE)
    .input(z.object({ id: z.uuid().nullable().default(null), tier: TierInputSchema }))
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      return surface(() => saveTier(ctxOf(context), input.id, input.tier))
    }),
  /** Remove a tier; its members are placed again by the nightly recalculation. */
  remove: can(permissions.SETTINGS_MANAGE)
    .input(byId)
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      await surface(() => deleteTier(ctxOf(context), input.id))
      return { ok: true as const }
    }),
  /** Work out one customer's tier now (after a manual change). */
  recalc: can(permissions.CUSTOMERS_WRITE)
    .input(z.object({ customerId: z.uuid() }))
    .handler(async ({ context, input }) => {
      const settings = await requireInstalled(context)
      return recalcTier(ctxOf(context), input.customerId, settings)
    }),
}

export const loyaltyCampaignsRouter = {
  /** Bonus campaigns, latest start first. */
  list: can(permissions.SETTINGS_READ).handler(async ({ context }) => {
    await requireInstalled(context)
    return listLoyaltyCampaigns(ctxOf(context))
  }),
  /** Add a bonus campaign (no id) or change one. */
  save: can(permissions.SETTINGS_MANAGE)
    .input(
      z.object({ id: z.uuid().nullable().default(null), campaign: LoyaltyCampaignInputSchema }),
    )
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      return surface(() => saveLoyaltyCampaign(ctxOf(context), input.id, input.campaign))
    }),
  /** Remove a bonus campaign; points already planned keep their boost. */
  remove: can(permissions.SETTINGS_MANAGE)
    .input(byId)
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      await surface(() => deleteLoyaltyCampaign(ctxOf(context), input.id))
      return { ok: true as const }
    }),
}
