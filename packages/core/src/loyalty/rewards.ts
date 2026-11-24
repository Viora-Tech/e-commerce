/** SOURCE OF TRUTH: the loyalty rewards catalog — WHAT: `loyalty_reward` rows (list, save, delete) and which rewards a member can take now (active, tier, usage limits, once per customer, enough points) / WHY: the admin catalog, the storefront rewards widget and the redeem path must agree on what is on offer */
import { loyaltyRedemption, loyaltyReward, loyaltyTier } from '@commerce/db'
import { and, asc, eq, inArray, ne, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { LoyaltyError } from './errors'
import { RewardInputSchema } from './schemas'

export type RewardRow = typeof loyaltyReward.$inferSelect

/** The catalog in the merchant's order; `activeOnly` for the storefront. */
export async function listRewards(
  ctx: StoreContext,
  opts: { activeOnly?: boolean } = {},
): Promise<RewardRow[]> {
  return ctx.tx
    .select()
    .from(loyaltyReward)
    .where(opts.activeOnly ? eq(loyaltyReward.active, true) : undefined)
    .orderBy(asc(loyaltyReward.position), asc(loyaltyReward.createdAt), asc(loyaltyReward.id))
}

/** Adds a reward (`id` null) or changes one. Changing it never touches codes already issued. */
export async function saveReward(
  ctx: StoreContext,
  id: string | null,
  raw: unknown,
  now: Date = new Date(),
): Promise<RewardRow> {
  const input = RewardInputSchema.parse(raw)
  const values = { ...input, updatedAt: now }
  if (id) {
    const [row] = await ctx.tx
      .update(loyaltyReward)
      .set(values)
      .where(eq(loyaltyReward.id, id))
      .returning()
    if (!row) throw new LoyaltyError('not_found', 'Reward not found', ctx.storeId)
    return row
  }
  const [row] = await ctx.tx
    .insert(loyaltyReward)
    .values({ ...values, storeId: ctx.storeId, createdAt: now })
    .returning()
  if (!row) throw new Error('Could not save the reward')
  return row
}

/**
 * Removes a reward that was never redeemed; one with redemptions is switched off instead (its
 * codes keep working). Returns what happened.
 */
export async function deleteReward(
  ctx: StoreContext,
  id: string,
): Promise<'deleted' | 'deactivated'> {
  const [used] = await ctx.tx
    .select({ n: sql<number>`count(*)::int` })
    .from(loyaltyRedemption)
    .where(eq(loyaltyRedemption.rewardId, id))
  if ((used?.n ?? 0) > 0) {
    const rows = await ctx.tx
      .update(loyaltyReward)
      .set({ active: false, updatedAt: new Date() })
      .where(eq(loyaltyReward.id, id))
      .returning({ id: loyaltyReward.id })
    if (rows.length === 0) throw new LoyaltyError('not_found', 'Reward not found', ctx.storeId)
    return 'deactivated'
  }
  const gone = await ctx.tx
    .delete(loyaltyReward)
    .where(eq(loyaltyReward.id, id))
    .returning({ id: loyaltyReward.id })
  if (gone.length === 0) throw new LoyaltyError('not_found', 'Reward not found', ctx.storeId)
  return 'deleted'
}

/** The threshold of a tier (0 when none), to compare a member's tier with a reward's minimum. */
async function tierThresholds(ctx: StoreContext, ids: string[]): Promise<Map<string, number>> {
  if (ids.length === 0) return new Map()
  const rows = await ctx.tx
    .select({ id: loyaltyTier.id, threshold: loyaltyTier.threshold })
    .from(loyaltyTier)
    .where(inArray(loyaltyTier.id, ids))
  return new Map(rows.map((r) => [r.id, r.threshold]))
}

export type RewardBlock = 'inactive' | 'tier' | 'sold_out' | 'already_redeemed' | 'points'

/**
 * Why a member cannot take a reward now, or null when they can. `points` is what they hold;
 * `cost` what this redemption costs (the chosen points for a custom amount).
 */
export async function rewardBlock(
  ctx: StoreContext,
  reward: RewardRow,
  member: { customerId: string; tierId: string | null; points: number },
  cost: number,
): Promise<RewardBlock | null> {
  if (!reward.active) return 'inactive'
  if (reward.minTierId) {
    const t = await tierThresholds(
      ctx,
      [reward.minTierId, member.tierId].filter(Boolean) as string[],
    )
    const need = t.get(reward.minTierId)
    const have = member.tierId ? t.get(member.tierId) : undefined
    if (need !== undefined && (have === undefined || have < need)) return 'tier'
  }
  if (reward.usageLimit !== null && reward.usedCount >= reward.usageLimit) return 'sold_out'
  if (reward.oncePerCustomer) {
    const [n] = await ctx.tx
      .select({ n: sql<number>`count(*)::int` })
      .from(loyaltyRedemption)
      .where(
        and(
          eq(loyaltyRedemption.rewardId, reward.id),
          eq(loyaltyRedemption.customerId, member.customerId),
          ne(loyaltyRedemption.status, 'cancelled'),
        ),
      )
    if ((n?.n ?? 0) > 0) return 'already_redeemed'
  }
  if (member.points < cost) return 'points'
  return null
}

/**
 * What a redemption of `reward` costs and is worth. A custom amount takes the shopper's
 * `points` (a whole number of steps of `pointsCost`, inside min and max) and gives `value`
 * paise per step; every other reward costs `pointsCost` and is worth `value`.
 */
export function rewardPrice(
  reward: Pick<RewardRow, 'type' | 'pointsCost' | 'value' | 'minPoints' | 'maxPoints'>,
  points?: number | null,
): { cost: number; value: number } | null {
  if (reward.type !== 'custom_amount_off') return { cost: reward.pointsCost, value: reward.value }
  const step = reward.pointsCost
  if (!points || step <= 0 || points % step !== 0) return null
  if (reward.minPoints !== null && points < reward.minPoints) return null
  if (reward.maxPoints !== null && points > reward.maxPoints) return null
  return { cost: points, value: (points / step) * reward.value }
}
