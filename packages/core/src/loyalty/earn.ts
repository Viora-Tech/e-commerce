/** SOURCE OF TRUTH: loyalty points for orders — WHAT: what an order earns (goods paid for, less store credit spent and refunds; shipping, GST and excluded product tags per the store), the pending entry made on delivery with the tier and campaign boost fixed on it, crediting any due entry in the store's home for points (store credit or the ledger), and taking points back on a refund, cancel or RTO / WHY: every point that lands or leaves is one ledger line under the member and account locks, and each step can run twice without doubling */
import { loyaltyEntry, order, orderLine, payment, product, refund, variant } from '@commerce/db'
import { and, asc, eq, gt, inArray, lte, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { changeStoreCredit } from '../customers/store-credit'
import { lockStoreCreditBalance } from '../customers/store-credit-expiry'
import { STORE_CREDIT_PROVIDER } from '../payments/split-tender'
import { creditPoints, ledgerPoints, takePoints } from './balance'
import { campaignBoost } from './campaigns'
import { pointsSummary } from './ledger'
import { canUseProgram, ensureMember, lockMember } from './member'
import { queueLoyaltyEmail } from './notify'
import { orderEarnConfig } from './rules'
import {
  boostedPoints,
  type LoyaltySettings,
  POINT_PAISE,
  pointsExpiryAt,
  pointsForPaise,
} from './settings'
import { pointsHoldMs } from './state'
import { memberTier, recalcTier } from './tiers'

type EntryRow = typeof loyaltyEntry.$inferSelect

/** Paid in full, or cash on delivery (paid at the door, and points wait for delivery anyway). */
const PAID_STATUSES = ['paid', 'partially_refunded']

/** How the store counts an order's points base (v2 settings; v1 defaults reproduce v1). */
export type PointsBaseOptions = {
  includeShipping?: boolean
  includeTaxes?: boolean
  excludeTags?: readonly string[]
}

/**
 * What an order earns points on, and whether it earns at all. The base is what the shopper paid
 * for goods: line totals (gift cards and lines whose product has an excluded tag left out) less
 * their share of the discount and any payment-method discount, less store credit spent on it
 * (no points on points), less refunds. Shipping counts only with `includeShipping`; GST is
 * taken out without `includeTaxes`. A COD fee earns nothing. `earns` is false for a test,
 * imported, draft, cancelled, returned or unpaid order, or one with no customer.
 */
export async function orderPointsBase(
  ctx: StoreContext,
  orderId: string,
  opts: PointsBaseOptions = {},
): Promise<{
  basePaise: number
  earns: boolean
  number: number
  customerId: string | null
  placedAt: Date
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
      shippingPaise: order.shippingPaise,
      taxPaise: order.taxPaise,
      placedAt: order.placedAt,
    })
    .from(order)
    .where(eq(order.id, orderId))
  if (!o) return null
  const excluded = [...(opts.excludeTags ?? [])]
  const excludedLine = excluded.length
    ? sql`coalesce(${product.tags}, '{}') && array[${sql.join(
        excluded.map((t) => sql`${t}`),
        sql`, `,
      )}]::text[]`
    : sql`false`
  const [lines] = await ctx.tx
    .select({
      goods: sql<number>`coalesce(sum(${orderLine.quantity} * ${orderLine.unitPricePaise}) filter (where not ${orderLine.giftCard}), 0)::int`,
      eligible: sql<number>`coalesce(sum(${orderLine.quantity} * ${orderLine.unitPricePaise}) filter (where not ${orderLine.giftCard} and not (${excludedLine})), 0)::int`,
    })
    .from(orderLine)
    .leftJoin(variant, eq(variant.id, orderLine.variantId))
    .leftJoin(product, eq(product.id, variant.productId))
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
  const allGoods = lines?.goods ?? 0
  const eligible = lines?.eligible ?? 0
  const share = allGoods > 0 ? eligible / allGoods : 0
  const off = o.discountPaise + Math.max(0, -o.paymentAdjustmentPaise)
  let goods = eligible - Math.round(off * share)
  if (opts.includeShipping) goods += o.shippingPaise
  if (opts.includeTaxes === false) goods -= Math.round(o.taxPaise * share)
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
  return { basePaise, earns, number: o.number, customerId: o.customerId, placedAt: o.placedAt }
}

/** The order spend rule and store settings as base options. */
async function earnSetup(ctx: StoreContext, settings: LoyaltySettings) {
  const cfg = await orderEarnConfig(ctx, settings)
  const opts: PointsBaseOptions = {
    includeShipping: settings.includeShipping,
    includeTaxes: settings.includeTaxes,
    excludeTags: cfg.excludeTags,
  }
  return { cfg, opts }
}

/** An order entry's points from the order as it is now, with its fixed boost; 0 when it no longer earns. */
async function orderPointsNow(
  ctx: StoreContext,
  e: Pick<EntryRow, 'orderId' | 'multiplierBp' | 'bonusPoints'>,
  settings: LoyaltySettings,
) {
  if (!e.orderId) return { points: 0, base: null }
  const { cfg, opts } = await earnSetup(ctx, settings)
  const base = await orderPointsBase(ctx, e.orderId, opts)
  const points = base?.earns
    ? boostedPoints(
        pointsForPaise(base.basePaise, cfg.pointsPer100),
        e.multiplierBp ?? 10_000,
        e.bonusPoints ?? 0,
      )
    : 0
  return { points, base }
}

/**
 * On delivery: a `pending` entry for the order, credited once the return window is over (the
 * sweep). The member's tier multiplier and any campaign running when the order was placed are
 * fixed on the entry; points are worked out now for the history and again when credited. Once
 * per order (unique index). Nothing for a customer outside the program. Returns the entry or null.
 */
export async function planOrderPoints(
  ctx: StoreContext,
  orderId: string,
  settings: LoyaltySettings,
  now: Date = new Date(),
): Promise<EntryRow | null> {
  const { cfg, opts } = await earnSetup(ctx, settings)
  if (cfg.pointsPer100 <= 0) return null
  const base = await orderPointsBase(ctx, orderId, opts)
  if (!base?.earns || !base.customerId) return null
  if (!(await canUseProgram(ctx, base.customerId, settings))) return null
  const basePoints = pointsForPaise(base.basePaise, cfg.pointsPer100)
  if (basePoints <= 0) return null
  await ensureMember(ctx, base.customerId, now)
  const tier = await memberTier(ctx, base.customerId)
  const boost = await campaignBoost(ctx, tier?.id ?? null, base.placedAt)
  const multiplierBp = Math.round(((tier?.multiplierBp ?? 10_000) * boost.multiplierBp) / 10_000)
  const points = boostedPoints(basePoints, multiplierBp, boost.bonusPoints)
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
      ruleId: cfg.ruleId,
      campaignId: boost.campaignId,
      multiplierBp,
      bonusPoints: boost.bonusPoints,
      reason: `Points for order #${base.number}`,
      availableAt: new Date(now.getTime() + hold),
    })
    .onConflictDoNothing()
    .returning()
  return row ?? null
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

/** Earning whose email is not worth sending (visits and streaks land too often). */
const QUIET_KEYS = /^(visit|streak):/

/**
 * Credits one pending entry whose time has come, in the store's home for points. An order's
 * points are worked out again from the order as it is now; any other entry tied to an order
 * (first order bonus, referral) is cancelled when that order no longer earns. Locks the entry
 * first, so two sweeps never credit it twice. Then the member's tier is worked out again and
 * the "points earned" (or birthday) email queued. Returns what happened.
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
    points = (await orderPointsNow(ctx, e, settings)).points
  } else if (e.orderId) {
    const base = await orderPointsBase(ctx, e.orderId)
    if (!base?.earns) points = 0
  }
  if (points <= 0) {
    await ctx.tx.update(loyaltyEntry).set({ status: 'cancelled' }).where(eq(loyaltyEntry.id, e.id))
    return 'cancelled'
  }
  await lockMember(ctx, e.customerId, now)
  let storeCreditEntryId: string | null = null
  let expiresAt = pointsExpiryAt(now, settings.expiryMonths)
  if (settings.pointsAsStoreCredit) {
    const done = await creditPoints(
      ctx,
      { customerId: e.customerId, points, reason: e.reason, orderId: e.orderId },
      settings,
      now,
    )
    storeCreditEntryId = done.storeCreditEntryId
    expiresAt = done.expiresAt
  }
  await ctx.tx
    .update(loyaltyEntry)
    .set({ status: 'credited', points, creditedAt: now, storeCreditEntryId, expiresAt })
    .where(eq(loyaltyEntry.id, e.id))
  await recalcTier(ctx, e.customerId, settings, now)
  if (e.source === 'birthday') {
    await queueLoyaltyEmail(
      ctx,
      {
        customerId: e.customerId,
        template: 'loyalty_birthday',
        dedupeKey: `earned:${e.id}`,
        data: { points },
      },
      now,
    )
  } else if (!QUIET_KEYS.test(e.earnKey ?? '')) {
    const { points: balancePoints } = await pointsSummary(ctx, e.customerId, 0, now)
    await queueLoyaltyEmail(
      ctx,
      {
        customerId: e.customerId,
        template: 'loyalty_points_earned',
        dedupeKey: `earned:${e.id}`,
        data: { points, balancePoints, reason: e.reason },
      },
      now,
    )
  }
  return 'credited'
}

/**
 * A refund, cancel or RTO on an order with points. Pending points are worked out again (or
 * cancelled); credited ones have the difference taken back from where they went (a negative
 * `loyalty` store credit line, or a ledger line) as a `reversal` entry, never more than the
 * customer holds (whatever is short is tried again on the next event). Locks the order's entry
 * first, so two events never take the same points twice. Bonus entries tied to the order go
 * too when it no longer earns (`reverseOrderBonuses`). Returns the order points taken back now.
 */
export async function reverseOrderPoints(
  ctx: StoreContext,
  orderId: string,
  settings: LoyaltySettings,
  now: Date = new Date(),
  /** The parcel came back (RTO): the order keeps no points, whatever its statuses say yet. */
  opts: { voided?: boolean } = {},
): Promise<number> {
  await reverseOrderBonuses(ctx, orderId, now, opts)
  const [e] = await ctx.tx
    .select()
    .from(loyaltyEntry)
    .where(and(eq(loyaltyEntry.orderId, orderId), eq(loyaltyEntry.source, 'order')))
    .for('update')
  if (!e || e.status === 'cancelled') return 0
  const now0 = await orderPointsNow(ctx, e, settings)
  const owed = opts.voided ? 0 : now0.points
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
  await lockMember(ctx, e.customerId, now)
  const number = now0.base?.number
  const reason = number
    ? `Points taken back: order #${number} refunded or cancelled`
    : 'Points taken back'
  const row = {
    storeId: ctx.storeId,
    customerId: e.customerId,
    source: 'reversal' as const,
    status: 'credited' as const,
    orderId,
    reason,
    availableAt: now,
    creditedAt: now,
  }
  if (!e.storeCreditEntryId) {
    const take = Math.min(due, await ledgerPoints(ctx, e.customerId, now))
    if (take <= 0) return 0
    await ctx.tx.insert(loyaltyEntry).values({ ...row, points: -take })
    return take
  }
  const balance = await lockStoreCreditBalance(ctx, e.customerId, now)
  const take = Math.min(due, Math.floor(balance / POINT_PAISE))
  if (take <= 0) return 0
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
  await ctx.tx
    .insert(loyaltyEntry)
    .values({ ...row, points: -take, storeCreditEntryId: line.entryId })
  return take
}

/**
 * Bonus points tied to an order (first order bonus, a referral's points) when the order no
 * longer earns: pending ones are cancelled, credited ones taken back once each (key
 * `reversal:<entry id>`), as far as the customer still holds points.
 */
async function reverseOrderBonuses(
  ctx: StoreContext,
  orderId: string,
  now: Date = new Date(),
  opts: { voided?: boolean } = {},
): Promise<void> {
  const bonuses = await ctx.tx
    .select()
    .from(loyaltyEntry)
    .where(
      and(
        eq(loyaltyEntry.orderId, orderId),
        inArray(loyaltyEntry.source, ['rule', 'referral']),
        gt(loyaltyEntry.points, 0),
        inArray(loyaltyEntry.status, ['pending', 'credited']),
      ),
    )
  if (bonuses.length === 0) return
  const base = await orderPointsBase(ctx, orderId)
  if (base?.earns && !opts.voided) return
  for (const b of bonuses) {
    if (b.status === 'pending') {
      await ctx.tx
        .update(loyaltyEntry)
        .set({ status: 'cancelled' })
        .where(eq(loyaltyEntry.id, b.id))
      continue
    }
    const key = `reversal:${b.id}`
    await lockMember(ctx, b.customerId, now)
    const [done] = await ctx.tx
      .select({ id: loyaltyEntry.id })
      .from(loyaltyEntry)
      .where(and(eq(loyaltyEntry.customerId, b.customerId), eq(loyaltyEntry.earnKey, key)))
    if (done) continue
    await takePoints(
      ctx,
      {
        customerId: b.customerId,
        points: b.points,
        source: 'reversal',
        reason: `Taken back: ${b.reason}`,
        orderId,
        earnKey: key,
        upTo: true,
      },
      now,
    )
  }
}
