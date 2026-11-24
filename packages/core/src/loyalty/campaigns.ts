/** SOURCE OF TRUTH: loyalty bonus campaigns — WHAT: `loyalty_campaign` rows (list, save, delete) and the bonus an order placed at a moment earns for a member's tier (the highest multiplier of the campaigns running, plus every fixed bonus) / WHY: order points are worked out at delivery, again at credit time and on refunds, so the boost is fixed on the entry once from the order's placed time */
import { loyaltyCampaign } from '@commerce/db'
import { and, desc, eq, gt, lte } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { LoyaltyError } from './errors'
import { LoyaltyCampaignInputSchema } from './schemas'

export type LoyaltyCampaignRow = typeof loyaltyCampaign.$inferSelect

/** Campaigns, latest start first. */
export async function listLoyaltyCampaigns(ctx: StoreContext): Promise<LoyaltyCampaignRow[]> {
  return ctx.tx.select().from(loyaltyCampaign).orderBy(desc(loyaltyCampaign.startsAt))
}

/** Adds a campaign (`id` null) or changes one. */
export async function saveLoyaltyCampaign(
  ctx: StoreContext,
  id: string | null,
  raw: unknown,
  now: Date = new Date(),
): Promise<LoyaltyCampaignRow> {
  const input = LoyaltyCampaignInputSchema.parse(raw)
  const values = { ...input, updatedAt: now }
  if (id) {
    const [row] = await ctx.tx
      .update(loyaltyCampaign)
      .set(values)
      .where(eq(loyaltyCampaign.id, id))
      .returning()
    if (!row) throw new LoyaltyError('not_found', 'Campaign not found', ctx.storeId)
    return row
  }
  const [row] = await ctx.tx
    .insert(loyaltyCampaign)
    .values({ ...values, storeId: ctx.storeId, createdAt: now })
    .returning()
  if (!row) throw new Error('Could not save the campaign')
  return row
}

export async function deleteLoyaltyCampaign(ctx: StoreContext, id: string): Promise<void> {
  const gone = await ctx.tx
    .delete(loyaltyCampaign)
    .where(eq(loyaltyCampaign.id, id))
    .returning({ id: loyaltyCampaign.id })
  if (gone.length === 0) throw new LoyaltyError('not_found', 'Campaign not found', ctx.storeId)
}

export type CampaignBoost = { multiplierBp: number; bonusPoints: number; campaignId: string | null }

/** Pure: the boost from the campaigns running at `at` for a member on `tierId`. */
export function boostFrom(
  campaigns: readonly LoyaltyCampaignRow[],
  tierId: string | null,
  at: Date,
): CampaignBoost {
  let multiplierBp = 10_000
  let bonusPoints = 0
  let campaignId: string | null = null
  for (const c of campaigns) {
    if (!c.active || c.startsAt > at || c.endsAt <= at) continue
    if (c.tierIds.length > 0 && (!tierId || !c.tierIds.includes(tierId))) continue
    if (c.bonusType === 'multiplier' && c.multiplierBp > multiplierBp) {
      multiplierBp = c.multiplierBp
      campaignId = c.id
    }
    if (c.bonusType === 'fixed') {
      bonusPoints += c.bonusPoints
      campaignId ??= c.id
    }
  }
  return { multiplierBp, bonusPoints, campaignId }
}

/** The boost an order placed at `at` earns for a member on `tierId`. */
export async function campaignBoost(
  ctx: StoreContext,
  tierId: string | null,
  at: Date,
): Promise<CampaignBoost> {
  const running = await ctx.tx
    .select()
    .from(loyaltyCampaign)
    .where(
      and(
        eq(loyaltyCampaign.active, true),
        lte(loyaltyCampaign.startsAt, at),
        gt(loyaltyCampaign.endsAt, at),
      ),
    )
  return boostFrom(running, tierId, at)
}
