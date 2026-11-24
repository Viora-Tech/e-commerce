/** SOURCE OF TRUTH: discount use bookkeeping — WHAT: claim a use of each applied discount under a row lock, record it per order (an unpaid checkout draft only notes it; counted when paid), and give the uses back when the order is undone / WHY: usage limits and per-customer caps must hold however many checkouts race, combined discounts each count a use, and a failed payment must not use up a shopper's code */
import { discount, discountUsage, orderNote } from '@commerce/db'
import { and, eq, isNull, lt, or, sql } from 'drizzle-orm'
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

type UseOrder = {
  id: string
  customerId: string | null
  email: string | null
  discountPaise: number
}

/**
 * Count and record a use of every discount on the order: one row each, combined discounts
 * with their own share, a single discount with the order's discount total.
 *
 * `noteOnly` is for an unpaid checkout draft: the rows are written (which discounts, how much)
 * but not counted against the limits; `countDraftDiscountUses` counts them when it is paid.
 * The limits were checked from a snapshot when the code was applied (`resolveDiscount`).
 */
export async function recordDiscountUses(
  ctx: StoreContext,
  applied: ResolvedDiscount,
  order: UseOrder,
  opts: { noteOnly?: boolean } = {},
): Promise<void> {
  const parts = applied.parts ?? [{ ...applied, amountPaise: order.discountPaise }]
  for (const part of parts) {
    const use = { ...order, discountPaise: part.amountPaise }
    if (opts.noteOnly) await insertUse(ctx, part.discount.id, use, false)
    else await recordDiscountUse(ctx, part.discount.id, use)
  }
}

async function insertUse(
  ctx: StoreContext,
  discountId: string,
  order: UseOrder,
  counted: boolean,
): Promise<void> {
  await ctx.tx.insert(discountUsage).values({
    storeId: ctx.storeId,
    discountId,
    orderId: order.id,
    customerId: order.customerId,
    // Per-customer caps key on the lower-cased email, as `customerUsageCount` reads it.
    email: order.email?.toLowerCase() ?? null,
    amountPaise: order.discountPaise,
    counted,
  })
}

/**
 * Count and record one use of one discount on an order, under the same lock and limits as
 * checkout: a draft order placed with a code (`convertDraft`) goes through here.
 */
export async function recordDiscountUse(
  ctx: StoreContext,
  discountId: string,
  order: UseOrder,
): Promise<void> {
  await claimDiscountUse(ctx, discountId, order.email?.toLowerCase() ?? null)
  await insertUse(ctx, discountId, order, true)
}

/** Timeline note when a paid checkout draft took a discount past its usage limit or cap. */
export const OVER_LIMIT_NOTE = (label: string) =>
  `Discount "${label}" was used past its limit: the shopper had already paid the discounted price, so it was kept.`

/**
 * A checkout draft was paid: count the uses it noted. The shopper has already paid the
 * discounted price, so a code that ran out meanwhile is still honoured (never refused here);
 * a timeline note says so when it went past the store's limit or the shopper's cap.
 */
export async function countDraftDiscountUses(ctx: StoreContext, orderId: string): Promise<void> {
  const uses = await ctx.tx
    .update(discountUsage)
    .set({ counted: true })
    .where(and(eq(discountUsage.orderId, orderId), eq(discountUsage.counted, false)))
    .returning({ discountId: discountUsage.discountId, email: discountUsage.email })
  for (const u of uses) {
    const [d] = await ctx.tx
      .update(discount)
      .set({ usedCount: sql`${discount.usedCount} + 1` })
      .where(eq(discount.id, u.discountId))
      .returning({
        usedCount: discount.usedCount,
        usageLimit: discount.usageLimit,
        usagePerCustomer: discount.usagePerCustomer,
        code: discount.code,
        title: discount.title,
      })
    if (!d) continue
    const overLimit = d.usageLimit !== null && d.usedCount > d.usageLimit
    const overCap =
      d.usagePerCustomer !== null &&
      (await customerUsageCount(ctx, u.discountId, u.email)) > d.usagePerCustomer
    if (overLimit || overCap) {
      await ctx.tx.insert(orderNote).values({
        storeId: ctx.storeId,
        orderId,
        body: OVER_LIMIT_NOTE(d.code ?? d.title),
        author: 'system',
      })
    }
  }
}

/**
 * Give back the discount uses an order recorded, so a fresh try counts its own (also undoes
 * `recordDiscountUses` when an order is rolled back). Only counted uses lower `used_count`;
 * a draft's noted uses never raised it.
 */
export async function releaseOrderDiscountUses(ctx: StoreContext, orderId: string): Promise<void> {
  const uses = await ctx.tx
    .delete(discountUsage)
    .where(eq(discountUsage.orderId, orderId))
    .returning({ discountId: discountUsage.discountId, counted: discountUsage.counted })
  for (const u of uses) {
    if (!u.counted) continue
    await ctx.tx
      .update(discount)
      .set({ usedCount: sql`greatest(${discount.usedCount} - 1, 0)` })
      .where(eq(discount.id, u.discountId))
  }
}
