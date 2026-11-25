/** SOURCE OF TRUTH: redeeming loyalty rewards — WHAT: a member spending points on a reward (points taken under the member lock, then a one-use discount code tied to them, or store credit), codes given free (a tier's reward, a referral), staff cancelling an unused code to give the points back, marking codes used by an order, and expiring unused codes / WHY: points and the code must move together exactly once; the code is an ordinary discount, so checkout's usage limits guard it */
import {
  customer,
  type DiscountBxgy,
  discount,
  discountUsage,
  loyaltyRedemption,
  loyaltyReward,
  newId,
} from '@commerce/db'
import { and, desc, eq, inArray, isNotNull, lte, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { changeStoreCredit } from '../customers/store-credit'
import { storeCreditLastDay, storeCreditTimeZone } from '../customers/store-credit-expiry'
import { addPoints, takePoints } from './balance'
import { LoyaltyError } from './errors'
import { pointsSummary } from './ledger'
import { canUseProgram, lockMember, newReferralCode } from './member'
import { queueLoyaltyEmail } from './notify'
import { type RewardRow, rewardBlock, rewardPrice } from './rewards'
import type { LoyaltyRewardType } from './schemas'
import type { LoyaltySettings } from './settings'

export type RedemptionRow = typeof loyaltyRedemption.$inferSelect

const DAY_MS = 86_400_000

/** What a code gives, in discount terms. */
type CodeOffer = {
  type: LoyaltyRewardType
  value: number
  productId?: string | null
  minOrderPaise?: number | null
}

/**
 * Makes the one-use discount code for a reward: only this customer may use it, once, until
 * `days` from now (never when null). Returns its id and code.
 */
async function makeRewardCode(
  ctx: StoreContext,
  customerId: string,
  title: string,
  offer: CodeOffer,
  days: number | null,
  now: Date,
): Promise<{ discountId: string; code: string; endsAt: Date | null }> {
  const endsAt = days ? new Date(now.getTime() + days * DAY_MS) : null
  const shape = discountShape(offer)
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = `REWARD-${newReferralCode()}`
    const [row] = await ctx.tx
      .insert(discount)
      .values({
        storeId: ctx.storeId,
        title: `Loyalty reward · ${title}`.slice(0, 120),
        kind: 'code',
        code,
        ...shape,
        minSubtotalPaise: offer.minOrderPaise ?? null,
        usageLimit: 1,
        usagePerCustomer: 1,
        customerEligibility: 'customers',
        eligibleIds: [customerId],
        startsAt: now,
        endsAt,
        status: 'active',
      })
      .onConflictDoNothing()
      .returning({ id: discount.id })
    if (row) return { discountId: row.id, code, endsAt }
  }
  throw new Error('Could not make a reward code')
}

/**
 * The discount fields for a reward. A free product is a buy X get Y on that one product where
 * buying it (₹0.01 of it) gets one unit free, once per order: the shopper adds it to the cart
 * and the code takes it off.
 */
function discountShape(offer: CodeOffer) {
  switch (offer.type) {
    case 'percent_off':
      return { type: 'order' as const, method: 'percent' as const, value: offer.value }
    case 'free_shipping':
      return { type: 'shipping' as const, method: 'free_shipping' as const, value: 0 }
    case 'free_product': {
      const ids = offer.productId ? [offer.productId] : []
      const bxgy: DiscountBxgy = {
        buys: { kind: 'amount', quantity: 0, amountPaise: 1, appliesTo: 'products', ids },
        gets: { quantity: 1, appliesTo: 'products', ids },
        maxUsesPerOrder: 1,
      }
      return { type: 'bxgy' as const, method: 'percent' as const, value: 10_000, bxgy }
    }
    default:
      return { type: 'order' as const, method: 'fixed' as const, value: offer.value }
  }
}

/**
 * Gives a reward's code or credit without taking points (a tier's reward, a referral): one
 * redemption row with 0 points. `via` says why.
 */
export async function grantFreeReward(
  ctx: StoreContext,
  input: {
    customerId: string
    title: string
    offer: CodeOffer
    days: number | null
    via: 'tier' | 'referral'
    rewardId?: string | null
  },
  now: Date = new Date(),
): Promise<RedemptionRow> {
  return issueRedemption(ctx, { ...input, id: newId(), points: 0 }, now)
}

async function issueRedemption(
  ctx: StoreContext,
  input: {
    id: string
    customerId: string
    title: string
    offer: CodeOffer
    days: number | null
    via: string
    points: number
    rewardId?: string | null
  },
  now: Date,
): Promise<RedemptionRow> {
  let discountId: string | null = null
  let code: string | null = null
  let expiresAt: Date | null = null
  let storeCreditEntryId: string | null = null
  if (input.offer.type === 'store_credit') {
    const line = await changeStoreCredit(
      ctx,
      {
        customerId: input.customerId,
        amountPaise: input.offer.value,
        kind: 'adjustment',
        reason: `Loyalty reward: ${input.title}`.slice(0, 200),
      },
      now,
    )
    storeCreditEntryId = line.entryId
  } else {
    const made = await makeRewardCode(
      ctx,
      input.customerId,
      input.title,
      input.offer,
      input.days,
      now,
    )
    discountId = made.discountId
    code = made.code
    expiresAt = made.endsAt
  }
  const [row] = await ctx.tx
    .insert(loyaltyRedemption)
    .values({
      id: input.id,
      storeId: ctx.storeId,
      customerId: input.customerId,
      rewardId: input.rewardId ?? null,
      rewardType: input.offer.type,
      title: input.title.slice(0, 120),
      points: input.points,
      value: input.offer.value,
      discountId,
      code,
      storeCreditEntryId,
      // Store credit is given on the spot: nothing left to use.
      status: input.offer.type === 'store_credit' ? 'used' : 'issued',
      via: input.via,
      expiresAt,
      createdAt: now,
    })
    .returning()
  if (!row) throw new Error('Could not record the redemption')
  const timeZone = await storeCreditTimeZone(ctx)
  await queueLoyaltyEmail(
    ctx,
    {
      customerId: input.customerId,
      template: 'loyalty_reward_redeemed',
      dedupeKey: `redeemed:${row.id}`,
      data: {
        title: row.title,
        points: row.points,
        code,
        lastDay: expiresAt ? storeCreditLastDay(expiresAt, timeZone) : null,
      },
    },
    now,
  )
  return row
}

/**
 * A member spends points on a reward. Locks the reward (usage limit) and the member (points),
 * checks tier, limits and points again under the locks, takes the points (oldest expiry
 * first), then issues the code or store credit. `points` is the shopper's choice for a custom
 * amount. Refuses with `LoyaltyError`: `not_eligible` (program closed to them, tier), `limit_reached`,
 * `insufficient`, `invalid` (custom points not a whole step).
 */
export async function redeemReward(
  ctx: StoreContext,
  input: { customerId: string; rewardId: string; points?: number | null | undefined },
  settings: LoyaltySettings,
  now: Date = new Date(),
): Promise<RedemptionRow> {
  if (!(await canUseProgram(ctx, input.customerId, settings))) {
    throw new LoyaltyError('not_eligible', 'This customer is not in the program', ctx.storeId)
  }
  const [reward] = await ctx.tx
    .select()
    .from(loyaltyReward)
    .where(eq(loyaltyReward.id, input.rewardId))
    .for('update')
  if (!reward) throw new LoyaltyError('not_found', 'Reward not found', ctx.storeId)
  const price = rewardPrice(reward, input.points)
  if (!price)
    throw new LoyaltyError('invalid', 'Pick a number of points this reward takes', ctx.storeId)
  const member = await lockMember(ctx, input.customerId, now)
  const { points } = await pointsSummary(ctx, input.customerId, 0, now)
  const block = await rewardBlock(
    ctx,
    reward,
    { customerId: input.customerId, tierId: member.tierId, points },
    price.cost,
  )
  if (block === 'points') throw new LoyaltyError('insufficient', 'Not enough points', ctx.storeId)
  if (block === 'sold_out' || block === 'already_redeemed') {
    throw new LoyaltyError('limit_reached', 'This reward cannot be taken again', ctx.storeId)
  }
  if (block) throw new LoyaltyError('not_eligible', 'This reward is not open to them', ctx.storeId)
  const id = newId()
  if (price.cost > 0) {
    await takePoints(
      ctx,
      {
        customerId: input.customerId,
        points: price.cost,
        source: 'redemption',
        reason: `Redeemed: ${reward.title}`,
        redemptionId: id,
      },
      now,
    )
  }
  await ctx.tx
    .update(loyaltyReward)
    .set({ usedCount: sql`${loyaltyReward.usedCount} + 1` })
    .where(eq(loyaltyReward.id, reward.id))
  return issueRedemption(
    ctx,
    {
      id,
      customerId: input.customerId,
      title: reward.title,
      offer: offerOf(reward, price.value),
      days: reward.codeDays,
      via: 'redeem',
      points: price.cost,
      rewardId: reward.id,
    },
    now,
  )
}

/** A catalog reward as a code offer, worth `value`. */
export function offerOf(reward: RewardRow, value = reward.value): CodeOffer {
  return {
    type: reward.type,
    value,
    productId: reward.productId,
    minOrderPaise: reward.minOrderPaise,
  }
}

/** Whether an order took the redemption's code. */
async function codeUsed(ctx: StoreContext, discountId: string): Promise<boolean> {
  const [d] = await ctx.tx
    .select({ used: discount.usedCount })
    .from(discount)
    .where(eq(discount.id, discountId))
  if ((d?.used ?? 0) > 0) return true
  const [u] = await ctx.tx
    .select({ n: sql<number>`count(*)::int` })
    .from(discountUsage)
    .where(eq(discountUsage.discountId, discountId))
  return (u?.n ?? 0) > 0
}

/**
 * Staff cancel a code nobody used (issued or expired): the code is switched off and the points
 * come back as a new credit (`redemption_refund`, expiring from today). A used code, store
 * credit already given, or a cancelled one is refused (`used` / `invalid`). Decision (24 Nov):
 * an order that used a reward code and is later refunded or cancelled keeps the code spent;
 * staff give points back by hand if they want to.
 */
export async function cancelRedemption(
  ctx: StoreContext,
  redemptionId: string,
  staffEmail: string | null,
  settings: LoyaltySettings,
  now: Date = new Date(),
): Promise<RedemptionRow> {
  const [r] = await ctx.tx
    .select()
    .from(loyaltyRedemption)
    .where(eq(loyaltyRedemption.id, redemptionId))
    .for('update')
  if (!r) throw new LoyaltyError('not_found', 'Redemption not found', ctx.storeId)
  if (r.status !== 'issued' && r.status !== 'expired') {
    throw new LoyaltyError(
      r.status === 'used' ? 'used' : 'invalid',
      'Only an unused code can be cancelled',
      ctx.storeId,
    )
  }
  if (r.discountId) {
    await ctx.tx
      .select({ id: discount.id })
      .from(discount)
      .where(eq(discount.id, r.discountId))
      .for('update')
    if (await codeUsed(ctx, r.discountId)) {
      await ctx.tx
        .update(loyaltyRedemption)
        .set({ status: 'used' })
        .where(eq(loyaltyRedemption.id, r.id))
      throw new LoyaltyError('used', 'An order already used this code', ctx.storeId)
    }
    await ctx.tx
      .update(discount)
      .set({ status: 'disabled', updatedAt: now })
      .where(eq(discount.id, r.discountId))
  }
  if (r.points > 0) {
    await addPoints(
      ctx,
      {
        customerId: r.customerId,
        points: r.points,
        source: 'redemption_refund',
        reason: `Reward cancelled: ${r.title}`,
        redemptionId: r.id,
        staffEmail,
      },
      settings,
      now,
    )
  }
  if (r.rewardId) {
    await ctx.tx
      .update(loyaltyReward)
      .set({ usedCount: sql`greatest(${loyaltyReward.usedCount} - 1, 0)` })
      .where(eq(loyaltyReward.id, r.rewardId))
  }
  const [row] = await ctx.tx
    .update(loyaltyRedemption)
    .set({ status: 'cancelled', cancelledAt: now, cancelledBy: staffEmail })
    .where(eq(loyaltyRedemption.id, r.id))
    .returning()
  if (!row) throw new Error('Redemption vanished')
  return row
}

/** Marks the reward codes an order used as used (order paid or delivered). Returns how many. */
export async function markRedemptionsUsed(ctx: StoreContext, orderId: string): Promise<number> {
  const used = await ctx.tx
    .select({ discountId: discountUsage.discountId })
    .from(discountUsage)
    .where(eq(discountUsage.orderId, orderId))
  const ids = used.map((u) => u.discountId)
  if (ids.length === 0) return 0
  const rows = await ctx.tx
    .update(loyaltyRedemption)
    .set({ status: 'used', orderId })
    .where(
      and(
        inArray(loyaltyRedemption.discountId, ids),
        inArray(loyaltyRedemption.status, ['issued', 'expired']),
      ),
    )
    .returning({ id: loyaltyRedemption.id })
  return rows.length
}

/** Unused codes past their end become `expired` (points stay spent; staff may still cancel). */
export async function expireRedemptions(
  ctx: StoreContext,
  now: Date = new Date(),
): Promise<number> {
  const rows = await ctx.tx
    .update(loyaltyRedemption)
    .set({ status: 'expired' })
    .where(
      and(
        eq(loyaltyRedemption.status, 'issued'),
        isNotNull(loyaltyRedemption.expiresAt),
        lte(loyaltyRedemption.expiresAt, now),
      ),
    )
    .returning({ id: loyaltyRedemption.id })
  return rows.length
}

/** Redemptions newest first, for the admin (one customer's, or the store's), with the customer. */
export async function listRedemptions(
  ctx: StoreContext,
  input: {
    customerId?: string | undefined
    status?: RedemptionRow['status'] | undefined
    page?: number | undefined
    perPage?: number | undefined
  },
): Promise<{
  rows: (RedemptionRow & { customerName: string | null; customerEmail: string | null })[]
  total: number
}> {
  const page = Math.max(1, input.page ?? 1)
  const perPage = Math.min(100, Math.max(1, input.perPage ?? 25))
  const where = and(
    input.customerId ? eq(loyaltyRedemption.customerId, input.customerId) : undefined,
    input.status ? eq(loyaltyRedemption.status, input.status) : undefined,
  )
  const rows = await ctx.tx
    .select({ r: loyaltyRedemption, customerName: customer.name, customerEmail: customer.email })
    .from(loyaltyRedemption)
    .innerJoin(customer, eq(customer.id, loyaltyRedemption.customerId))
    .where(where)
    .orderBy(desc(loyaltyRedemption.createdAt), desc(loyaltyRedemption.id))
    .limit(perPage)
    .offset((page - 1) * perPage)
  const [n] = await ctx.tx
    .select({ n: sql<number>`count(*)::int` })
    .from(loyaltyRedemption)
    .where(where)
  return {
    rows: rows.map((x) => ({
      ...x.r,
      customerName: x.customerName,
      customerEmail: x.customerEmail,
    })),
    total: n?.n ?? 0,
  }
}
