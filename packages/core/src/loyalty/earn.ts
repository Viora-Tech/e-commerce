/** SOURCE OF TRUTH: loyalty points for orders — WHAT: what an order earns (goods paid for, less store credit spent and refunds), the pending entry made on delivery, crediting any due entry as a `loyalty` store credit line that expires, and taking points back on a refund, cancel or RTO / WHY: points are store credit, so every point that lands or leaves is one ledger line under the account lock, and each step can run twice without doubling */
import { loyaltyEntry, order, orderLine, payment, refund } from '@commerce/db'
import { and, asc, eq, lte, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { changeStoreCredit } from '../customers/store-credit'
import { lockStoreCreditBalance } from '../customers/store-credit-expiry'
import { STORE_CREDIT_PROVIDER } from '../payments/split-tender'
import { type LoyaltySettings, POINT_PAISE, pointsExpiryAt, pointsForPaise } from './settings'
import { pointsHoldMs } from './state'

type EntryRow = typeof loyaltyEntry.$inferSelect

/** Paid in full, or cash on delivery (paid at the door, and points wait for delivery anyway). */
const PAID_STATUSES = ['paid', 'partially_refunded']

/**
 * What an order earns points on, and whether it earns at all. The base is what the shopper paid
 * for goods: line totals (gift cards left out) less the discount and any payment-method
 * discount, less store credit spent on it (no points on points), less refunds. Shipping and a
 * COD fee earn nothing. `earns` is false for a test, imported, draft, cancelled, returned or
 * unpaid order, or one with no customer.
 */
export async function orderPointsBase(
  ctx: StoreContext,
  orderId: string,
): Promise<{
  basePaise: number
  earns: boolean
  number: number
  customerId: string | null
} | null> {
  const [o] = await ctx.tx
    .select({
      number: order.number,
      customerId: order.customerId,
      status: order.status,
      paymentStatus: order.paymentStatus,
      fulfillmentStatus: order.fulfillmentStatus,
      paymentMethod: order.paymentMethod,
      isTest: order.isTest,
      importedFrom: order.importedFrom,
      discountPaise: order.discountPaise,
      paymentAdjustmentPaise: order.paymentAdjustmentPaise,
    })
    .from(order)
    .where(eq(order.id, orderId))
  if (!o) return null
  const [lines] = await ctx.tx
    .select({
      goods: sql<number>`coalesce(sum(${orderLine.quantity} * ${orderLine.unitPricePaise}) filter (where not ${orderLine.giftCard}), 0)::int`,
    })
    .from(orderLine)
    .where(eq(orderLine.orderId, orderId))
  const [credit] = await ctx.tx
    .select({ paise: sql<number>`coalesce(sum(${payment.amountPaise}), 0)::int` })
    .from(payment)
    .where(
      and(
        eq(payment.orderId, orderId),
        eq(payment.provider, STORE_CREDIT_PROVIDER),
        eq(payment.status, 'captured'),
      ),
    )
  const [back] = await ctx.tx
    .select({ paise: sql<number>`coalesce(sum(${refund.amountPaise}), 0)::int` })
    .from(refund)
    .where(and(eq(refund.orderId, orderId), sql`${refund.status} in ('processed', 'manual')`))
  const goods = (lines?.goods ?? 0) - o.discountPaise - Math.max(0, -o.paymentAdjustmentPaise)
  const basePaise = Math.max(0, goods - (credit?.paise ?? 0) - (back?.paise ?? 0))
  const paid = o.paymentMethod === 'cod' || PAID_STATUSES.includes(o.paymentStatus)
  const earns =
    Boolean(o.customerId) &&
    !o.isTest &&
    !o.importedFrom &&
    o.status !== 'cancelled' &&
    o.status !== 'draft' &&
    o.fulfillmentStatus !== 'returned' &&
    paid
  return { basePaise, earns, number: o.number, customerId: o.customerId }
}

/**
 * On delivery: a `pending` entry for the order, credited once the return window is over (the
 * sweep). Points are worked out now for the history and again when they are credited. Once per
 * order (unique index), so a second delivery event changes nothing. Returns the entry or null.
 */
export async function planOrderPoints(
  ctx: StoreContext,
  orderId: string,
  settings: LoyaltySettings,
  now: Date = new Date(),
): Promise<EntryRow | null> {
  if (settings.pointsPer100 <= 0) return null
  const base = await orderPointsBase(ctx, orderId)
  if (!base?.earns || !base.customerId) return null
  const points = pointsForPaise(base.basePaise, settings.pointsPer100)
  if (points <= 0) return null
  const hold = await pointsHoldMs(ctx.tx, ctx.storeId)
  const [row] = await ctx.tx
    .insert(loyaltyEntry)
    .values({
      storeId: ctx.storeId,
      customerId: base.customerId,
      source: 'order',
      status: 'pending',
      points,
      orderId,
      reason: `Points for order #${base.number}`,
      availableAt: new Date(now.getTime() + hold),
    })
    .onConflictDoNothing()
    .returning()
  return row ?? null
}

/**
 * Puts `points` on the customer's balance as one `loyalty` store credit line that runs out
 * `expiryMonths` later. In the caller's transaction, under the account lock.
 */
export async function creditPoints(
  ctx: StoreContext,
  input: { customerId: string; points: number; reason: string; orderId?: string | null },
  settings: LoyaltySettings,
  now: Date,
): Promise<{ storeCreditEntryId: string; expiresAt: Date | null }> {
  const expiresAt = pointsExpiryAt(now, settings.expiryMonths)
  const done = await changeStoreCredit(
    ctx,
    {
      customerId: input.customerId,
      amountPaise: input.points * POINT_PAISE,
      kind: 'loyalty',
      reason: input.reason,
      orderId: input.orderId ?? null,
      expiresAt,
    },
    now,
  )
  return { storeCreditEntryId: done.entryId, expiresAt }
}

/** Pending entries whose time has come, oldest first (at most `limit`), for the sweep. */
export async function duePointEntryIds(
  ctx: StoreContext,
  now: Date = new Date(),
  limit = 200,
): Promise<string[]> {
  const rows = await ctx.tx
    .select({ id: loyaltyEntry.id })
    .from(loyaltyEntry)
    .where(and(eq(loyaltyEntry.status, 'pending'), lte(loyaltyEntry.availableAt, now)))
    .orderBy(asc(loyaltyEntry.availableAt))
    .limit(limit)
  return rows.map((r) => r.id)
}

/**
 * Credits one pending entry whose time has come. An order's points are worked out again from
 * the order as it is now (refunds in the return window lower them; a cancel, RTO or full refund
 * cancels the entry). Locks the entry first, so two sweeps never credit it twice. Returns what
 * happened.
 */
export async function creditDueEntry(
  ctx: StoreContext,
  entryId: string,
  settings: LoyaltySettings,
  now: Date = new Date(),
): Promise<'credited' | 'cancelled' | 'skipped'> {
  const [e] = await ctx.tx
    .select()
    .from(loyaltyEntry)
    .where(eq(loyaltyEntry.id, entryId))
    .for('update')
  if (e?.status !== 'pending' || e.availableAt.getTime() > now.getTime()) return 'skipped'
  let points = e.points
  if (e.source === 'order' && e.orderId) {
    const base = await orderPointsBase(ctx, e.orderId)
    points = base?.earns ? pointsForPaise(base.basePaise, settings.pointsPer100) : 0
  }
  if (points <= 0) {
    await ctx.tx.update(loyaltyEntry).set({ status: 'cancelled' }).where(eq(loyaltyEntry.id, e.id))
    return 'cancelled'
  }
  const done = await creditPoints(
    ctx,
    { customerId: e.customerId, points, reason: e.reason, orderId: e.orderId },
    settings,
    now,
  )
  await ctx.tx
    .update(loyaltyEntry)
    .set({
      status: 'credited',
      points,
      creditedAt: now,
      storeCreditEntryId: done.storeCreditEntryId,
      expiresAt: done.expiresAt,
    })
    .where(eq(loyaltyEntry.id, e.id))
  return 'credited'
}

/**
 * A refund, cancel or RTO on an order with points. Pending points are worked out again (or
 * cancelled); credited ones have the difference taken back as a negative `loyalty` line and a
 * `reversal` entry, never more than the balance holds (whatever is short is tried again on the
 * next event). Locks the order's entry first, so two events never take the same points twice.
 * Returns the points taken back now.
 */
export async function reverseOrderPoints(
  ctx: StoreContext,
  orderId: string,
  settings: LoyaltySettings,
  now: Date = new Date(),
  /** The parcel came back (RTO): the order keeps no points, whatever its statuses say yet. */
  opts: { voided?: boolean } = {},
): Promise<number> {
  const [e] = await ctx.tx
    .select()
    .from(loyaltyEntry)
    .where(and(eq(loyaltyEntry.orderId, orderId), eq(loyaltyEntry.source, 'order')))
    .for('update')
  if (!e || e.status === 'cancelled') return 0
  const base = await orderPointsBase(ctx, orderId)
  const owed =
    base?.earns && !opts.voided ? pointsForPaise(base.basePaise, settings.pointsPer100) : 0
  if (e.status === 'pending') {
    await ctx.tx
      .update(loyaltyEntry)
      .set(owed > 0 ? { points: owed } : { status: 'cancelled' })
      .where(eq(loyaltyEntry.id, e.id))
    return 0
  }
  const [taken] = await ctx.tx
    .select({ points: sql<number>`coalesce(sum(${loyaltyEntry.points}), 0)::int` })
    .from(loyaltyEntry)
    .where(
      and(
        eq(loyaltyEntry.orderId, orderId),
        eq(loyaltyEntry.source, 'reversal'),
        eq(loyaltyEntry.status, 'credited'),
      ),
    )
  const held = e.points + (taken?.points ?? 0)
  const due = held - owed
  if (due <= 0) return 0
  const balance = await lockStoreCreditBalance(ctx, e.customerId, now)
  const take = Math.min(due, Math.floor(balance / POINT_PAISE))
  if (take <= 0) return 0
  const number = base?.number
  const reason = number
    ? `Points taken back: order #${number} refunded or cancelled`
    : 'Points taken back'
  const line = await changeStoreCredit(
    ctx,
    {
      customerId: e.customerId,
      amountPaise: -take * POINT_PAISE,
      kind: 'loyalty',
      reason,
      orderId,
    },
    now,
  )
  await ctx.tx.insert(loyaltyEntry).values({
    storeId: ctx.storeId,
    customerId: e.customerId,
    source: 'reversal',
    status: 'credited',
    points: -take,
    orderId,
    reason,
    availableAt: now,
    creditedAt: now,
    storeCreditEntryId: line.entryId,
  })
  return take
}
