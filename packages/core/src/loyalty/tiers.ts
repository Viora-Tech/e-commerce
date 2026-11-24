/** SOURCE OF TRUTH: loyalty VIP tiers — WHAT: `loyalty_tier` rows (list, save, delete), what a member qualifies on (points earned or money spent, lifetime or the last 12 months), working out and moving a member's tier (history row, customer tag, the tier's free reward, the "tier unlocked" email), and progress to the next tier / WHY: the multiplier on order points, reward eligibility and the storefront card all read the one tier stored on the member, so moving it is one place */
import {
  customer,
  loyaltyEntry,
  loyaltyMember,
  loyaltyReward,
  loyaltyTier,
  loyaltyTierChange,
} from '@commerce/db'
import { and, asc, eq, gte, inArray, notInArray, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { customerSpentSinceSql, customerSpentSql } from '../customers/spent'
import { LoyaltyError } from './errors'
import { lockMember } from './member'
import { queueLoyaltyEmail } from './notify'
import { grantFreeReward, offerOf } from './redeem'
import { TierInputSchema } from './schemas'
import type { LoyaltySettings } from './settings'

export type TierRow = typeof loyaltyTier.$inferSelect

const YEAR_MS = 365 * 86_400_000

/** Sources that are not points earned (spending, giving back, running out, resets). */
const NOT_EARNED = ['redemption', 'redemption_refund', 'expiry', 'reset'] as const

/** Tiers lowest first (threshold, then position). */
export async function listTiers(ctx: StoreContext): Promise<TierRow[]> {
  return ctx.tx
    .select()
    .from(loyaltyTier)
    .orderBy(asc(loyaltyTier.threshold), asc(loyaltyTier.position), asc(loyaltyTier.createdAt))
}

/** Adds a tier (`id` null) or changes one. Members move on their next recalculation. */
export async function saveTier(
  ctx: StoreContext,
  id: string | null,
  raw: unknown,
  now: Date = new Date(),
): Promise<TierRow> {
  const input = TierInputSchema.parse(raw)
  const values = { ...input, updatedAt: now }
  if (id) {
    const [row] = await ctx.tx
      .update(loyaltyTier)
      .set(values)
      .where(eq(loyaltyTier.id, id))
      .returning()
    if (!row) throw new LoyaltyError('not_found', 'Tier not found', ctx.storeId)
    return row
  }
  const [row] = await ctx.tx
    .insert(loyaltyTier)
    .values({ ...values, storeId: ctx.storeId, createdAt: now })
    .returning()
  if (!row) throw new Error('Could not save the tier')
  return row
}

/** Removes a tier; its members have no tier until the next recalculation places them. */
export async function deleteTier(ctx: StoreContext, id: string): Promise<void> {
  await ctx.tx
    .update(loyaltyMember)
    .set({ tierId: null, tierCheckedDay: null })
    .where(eq(loyaltyMember.tierId, id))
  const gone = await ctx.tx
    .delete(loyaltyTier)
    .where(eq(loyaltyTier.id, id))
    .returning({ id: loyaltyTier.id })
  if (gone.length === 0) throw new LoyaltyError('not_found', 'Tier not found', ctx.storeId)
}

/** The highest tier whose threshold `value` reaches (tiers lowest first), or null. Pure. */
export function tierFor<T extends { threshold: number }>(
  tiers: readonly T[],
  value: number,
): T | null {
  let best: T | null = null
  for (const t of tiers) if (value >= t.threshold) best = t
  return best
}

/**
 * What the member qualifies on: points earned (credited earning, less points taken back, not
 * counting rewards, refunds of rewards, expiry or resets) or paise spent (paid and kept), over
 * the whole membership or the last 12 months.
 */
export async function tierValue(
  ctx: StoreContext,
  customerId: string,
  settings: LoyaltySettings,
  now: Date = new Date(),
): Promise<number> {
  const since = settings.tierWindow === 'rolling_12m' ? new Date(now.getTime() - YEAR_MS) : null
  if (settings.tierBasis === 'spend') {
    const spent = since
      ? customerSpentSinceSql(sql`${customer.id}`, since)
      : customerSpentSql(sql`${customer.id}`)
    const [row] = await ctx.tx
      .select({ v: spent })
      .from(customer)
      .where(eq(customer.id, customerId))
    return row?.v ?? 0
  }
  const [row] = await ctx.tx
    .select({ v: sql<number>`coalesce(sum(${loyaltyEntry.points}), 0)::int` })
    .from(loyaltyEntry)
    .where(
      and(
        eq(loyaltyEntry.customerId, customerId),
        eq(loyaltyEntry.status, 'credited'),
        notInArray(loyaltyEntry.source, [...NOT_EARNED]),
        since ? gte(loyaltyEntry.createdAt, since) : undefined,
      ),
    )
  return Math.max(0, row?.v ?? 0)
}

export type TierMove = { changed: boolean; fromTierId: string | null; toTierId: string | null }

/**
 * Works out the member's tier now and moves them when it differs: a `loyalty_tier_change`
 * row, the tier's customer tag (the old tier's tag removed), and on a move up the tier's free
 * reward and the "tier unlocked" email (each once per tier, ever). Under the member lock.
 */
export async function recalcTier(
  ctx: StoreContext,
  customerId: string,
  settings: LoyaltySettings,
  now: Date = new Date(),
): Promise<TierMove> {
  const tiers = await listTiers(ctx)
  const member = await lockMember(ctx, customerId, now)
  const value = await tierValue(ctx, customerId, settings, now)
  const next = tierFor(tiers, value)
  const from = member.tierId
  const to = next?.id ?? null
  if (from === to) return { changed: false, fromTierId: from, toTierId: to }
  await ctx.tx
    .update(loyaltyMember)
    .set({ tierId: to, tierChangedAt: now })
    .where(eq(loyaltyMember.id, member.id))
  await ctx.tx.insert(loyaltyTierChange).values({
    storeId: ctx.storeId,
    customerId,
    fromTierId: from,
    toTierId: to,
    createdAt: now,
  })
  await retag(ctx, customerId, tiers, next, now)
  const old = tiers.find((t) => t.id === from)
  const up = next && (!old || next.threshold > old.threshold)
  if (up) await unlock(ctx, customerId, next, now)
  return { changed: true, fromTierId: from, toTierId: to }
}

/** Swaps the tier tags on the customer: every tier's tag off, the new tier's on. */
async function retag(
  ctx: StoreContext,
  customerId: string,
  tiers: TierRow[],
  next: TierRow | null,
  at: Date,
) {
  const tierTags = new Set(tiers.map((t) => t.customerTag).filter(Boolean) as string[])
  if (tierTags.size === 0) return
  const [c] = await ctx.tx
    .select({ tags: customer.tags })
    .from(customer)
    .where(eq(customer.id, customerId))
  if (!c) return
  const kept = c.tags.filter((t) => !tierTags.has(t))
  const tags = next?.customerTag ? [...kept, next.customerTag] : kept
  if (tags.join('\u0000') === c.tags.join('\u0000')) return
  await ctx.tx.update(customer).set({ tags, updatedAt: at }).where(eq(customer.id, customerId))
}

/** First time on this tier: its free reward (once) and the "tier unlocked" email (once). */
async function unlock(ctx: StoreContext, customerId: string, tier: TierRow, at: Date) {
  let rewardTitle: string | null = null
  if (tier.rewardId) {
    const [reward] = await ctx.tx
      .select()
      .from(loyaltyReward)
      .where(eq(loyaltyReward.id, tier.rewardId))
    const fresh = await queueLoyaltyEmail(
      ctx,
      {
        customerId,
        template: 'loyalty_tier_unlocked',
        dedupeKey: `tier:${tier.id}`,
        data: { tierName: tier.name, perks: tier.perks, rewardTitle: reward?.title ?? null },
      },
      at,
    )
    if (fresh && reward) {
      await grantFreeReward(
        ctx,
        {
          customerId,
          title: reward.title,
          offer: offerOf(reward),
          days: reward.codeDays,
          via: 'tier',
          rewardId: reward.id,
        },
        at,
      )
      rewardTitle = reward.title
    }
    return rewardTitle
  }
  await queueLoyaltyEmail(
    ctx,
    {
      customerId,
      template: 'loyalty_tier_unlocked',
      dedupeKey: `tier:${tier.id}`,
      data: { tierName: tier.name, perks: tier.perks, rewardTitle: null },
    },
    at,
  )
  return rewardTitle
}

/** The member's tier row (for the multiplier and the card), or null. */
export async function memberTier(ctx: StoreContext, customerId: string): Promise<TierRow | null> {
  const [row] = await ctx.tx
    .select({ tier: loyaltyTier })
    .from(loyaltyMember)
    .innerJoin(loyaltyTier, eq(loyaltyTier.id, loyaltyMember.tierId))
    .where(eq(loyaltyMember.customerId, customerId))
  return row?.tier ?? null
}

/** The storefront's tier card: current tier, the next one and how far there is to go. */
export async function tierProgress(
  ctx: StoreContext,
  customerId: string,
  settings: LoyaltySettings,
  now: Date = new Date(),
) {
  const tiers = await listTiers(ctx)
  const value = await tierValue(ctx, customerId, settings, now)
  const current = await memberTier(ctx, customerId)
  const next = tiers.find((t) => t.threshold > value && t.id !== current?.id) ?? null
  return {
    basis: settings.tierBasis,
    window: settings.tierWindow,
    value,
    current,
    next,
    toNext: next ? next.threshold - value : 0,
  }
}

/**
 * Nightly: members not looked at yet today (store-time `day`) get their tier worked out, so a
 * rolling 12-month window lets members slip down. Returns how many moved.
 */
export async function recalcTiersBatch(
  ctx: StoreContext,
  settings: LoyaltySettings,
  day: string,
  now: Date = new Date(),
  limit = 300,
): Promise<number> {
  const [any] = await ctx.tx.select({ n: sql<number>`count(*)::int` }).from(loyaltyTier)
  if ((any?.n ?? 0) === 0) return 0
  const due = await ctx.tx
    .select({ customerId: loyaltyMember.customerId, id: loyaltyMember.id })
    .from(loyaltyMember)
    .where(sql`${loyaltyMember.tierCheckedDay} is distinct from ${day}`)
    .limit(limit)
  let moved = 0
  for (const m of due) {
    const r = await recalcTier(ctx, m.customerId, settings, now)
    if (r.changed) moved += 1
  }
  if (due.length > 0) {
    await ctx.tx
      .update(loyaltyMember)
      .set({ tierCheckedDay: day })
      .where(
        inArray(
          loyaltyMember.id,
          due.map((m) => m.id),
        ),
      )
  }
  return moved
}
