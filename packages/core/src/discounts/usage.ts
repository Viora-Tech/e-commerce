/** SOURCE OF TRUTH: discount use bookkeeping — WHAT: claim a use of each applied discount under a row lock, record it per order, and give the uses back when the order is undone / WHY: usage limits and per-customer caps must hold however many checkouts race, and combined discounts each count a use */
import { discount, discountUsage } from '@commerce/db'
import { and, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { DiscountUnavailable } from '../errors'
import { customerUsageCount, type ResolvedDiscount } from './resolve'

/**
 * Count one use of a discount, or throw `DiscountUnavailable` when it has run
 * out. `resolveDiscount` checked the limits from a snapshot, and a concurrent
 * checkout may have used the last redemption since. So the discount row is
 * locked for the rest of the transaction, the shopper's cap is re-counted under
 * that lock, and the increment only happens while `used_count` is under the
 * limit: a limit of 100 means 100 orders however many checkouts race.
 *
 * Pattern from Medusa's promotion `registerUsage` (MIT): lock the promotion
 * row, then re-check the limits under the lock.
 */
async function claimDiscountUse(
  ctx: StoreContext,
  discountId: string,
  email: string | null,
): Promise<void> {
  const [d] = await ctx.tx
    .select({ usagePerCustomer: discount.usagePerCustomer })
    .from(discount)
    .where(eq(discount.id, discountId))
    .for('update')
  if (!d) throw new DiscountUnavailable(discountId, ctx.storeId)
  if (d.usagePerCustomer !== null) {
    const uses = await customerUsageCount(ctx, discountId, email)
    if (uses >= d.usagePerCustomer) throw new DiscountUnavailable(discountId, ctx.storeId)
  }
  const claimed = await ctx.tx
    .update(discount)
    .set({ usedCount: sql`${discount.usedCount} + 1` })
    .where(
      and(
        eq(discount.id, discountId),
        or(isNull(discount.usageLimit), lt(discount.usedCount, discount.usageLimit)),
      ),
    )
    .returning({ id: discount.id })
  if (claimed.length === 0) throw new DiscountUnavailable(discountId, ctx.storeId)
}

/**
 * Count and record a use of every discount on the order: one row each, combined discounts
 * with their own share, a single discount with the order's discount total.
 */
export async function recordDiscountUses(
  ctx: StoreContext,
  applied: ResolvedDiscount,
  order: { id: string; customerId: string | null; email: string | null; discountPaise: number },
): Promise<void> {
  const parts = applied.parts ?? [{ ...applied, amountPaise: order.discountPaise }]
  for (const part of parts) {
    await claimDiscountUse(ctx, part.discount.id, order.email)
    await ctx.tx.insert(discountUsage).values({
      storeId: ctx.storeId,
      discountId: part.discount.id,
      orderId: order.id,
      customerId: order.customerId,
      email: order.email,
      amountPaise: part.amountPaise,
    })
  }
}

/** Undo `recordDiscountUses` for an order that is being rolled back. */
export async function releaseDiscountUses(
  ctx: StoreContext,
  applied: ResolvedDiscount,
  orderId: string,
): Promise<void> {
  await ctx.tx.delete(discountUsage).where(eq(discountUsage.orderId, orderId))
  await ctx.tx
    .update(discount)
    .set({ usedCount: sql`greatest(${discount.usedCount} - 1, 0)` })
    .where(
      inArray(
        discount.id,
        (applied.parts ?? [applied]).map((p) => p.discount.id),
      ),
    )
}
