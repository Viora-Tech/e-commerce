/** SOURCE OF TRUTH: affiliate commissions — WHAT: which affiliate an order earns for, the hold, approval with TDS, reversals / WHY: order events (paid, delivered, cancelled, RTO, refund) all land here */
import { insertOutboxEvent, ORDER_EDIT_REFUND_REASON, phoneBlindIndex } from '@commerce/core'
import {
  address,
  collectionProduct,
  customerAddress,
  order,
  orderLine,
  refund,
  type StoreTx,
  variant,
} from '@commerce/db'
import { and, asc, eq, gte, inArray, isNull, lte, ne, sql } from 'drizzle-orm'
import { orderRisk } from './blocklist'
import { type CommissionLine, computeCommission, scaleForRefund, tierFor } from './commission'
import { addressKey, type FraudFinding, phoneKey, selfReferral } from './fraud'
import { canReverse, eligibleAt, isDue, type ReverseReason } from './hold'
import { earlierOrders, matchAffiliate } from './match'
import { affiliate, affiliateCommission } from './schema'
import type { StoreAffiliateSettings } from './settings'
import { financialYearStart, tdsForCredit } from './tds'

export type CommissionRow = typeof affiliateCommission.$inferSelect
type AffiliateRow = typeof affiliate.$inferSelect
type OrderRow = typeof order.$inferSelect

export async function commissionLines(tx: StoreTx, orderId: string): Promise<CommissionLine[]> {
  const lines = await tx
    .select({
      productId: variant.productId,
      quantity: orderLine.quantity,
      unitPricePaise: orderLine.unitPricePaise,
      gstRatePercent: orderLine.gstRatePercent,
      giftCard: orderLine.giftCard,
    })
    .from(orderLine)
    .innerJoin(variant, eq(variant.id, orderLine.variantId))
    .where(eq(orderLine.orderId, orderId))
  const productIds = [...new Set(lines.map((l) => l.productId))]
  const memberships = productIds.length
    ? await tx
        .select({
          productId: collectionProduct.productId,
          collectionId: collectionProduct.collectionId,
        })
        .from(collectionProduct)
        .where(inArray(collectionProduct.productId, productIds))
    : []
  return lines.map((l) => ({
    ...l,
    collectionIds: memberships
      .filter((m) => m.productId === l.productId)
      .map((m) => m.collectionId),
  }))
}

async function fraudCheck(
  tx: StoreTx,
  a: AffiliateRow,
  o: OrderRow,
  secret: string,
): Promise<FraudFinding | null> {
  const saved = a.customerId
    ? await tx
        .select({ line1: customerAddress.line1, pincode: customerAddress.pincode })
        .from(customerAddress)
        .where(eq(customerAddress.customerId, a.customerId))
    : []
  const [ship] = o.shippingAddressId
    ? await tx
        .select({ line1: address.line1, pincode: address.pincode })
        .from(address)
        .where(eq(address.id, o.shippingAddressId))
    : []
  const key = phoneKey(o.phone)
  return selfReferral(
    {
      customerId: a.customerId,
      email: a.email,
      phoneIndex: a.phoneIndex,
      addressKeys: saved.map((s) => addressKey(s.line1, s.pincode)).filter((k): k is string => !!k),
    },
    {
      customerId: o.customerId,
      email: o.email,
      phoneIndex: key ? phoneBlindIndex(key, secret) : null,
      addressKey: ship ? addressKey(ship.line1, ship.pincode) : null,
    },
  )
}

/** Net sales an affiliate brought that were earned (approved or paid), for tiers. */
export async function approvedSales(tx: StoreTx, affiliateId: string): Promise<number> {
  const [r] = await tx
    .select({ s: sql<number>`coalesce(sum(${affiliateCommission.basePaise}), 0)::int` })
    .from(affiliateCommission)
    .where(
      and(
        eq(affiliateCommission.affiliateId, affiliateId),
        inArray(affiliateCommission.status, ['approved', 'paid']),
      ),
    )
  return r?.s ?? 0
}

export async function commissionForOrder(
  tx: StoreTx,
  orderId: string,
): Promise<CommissionRow | null> {
  const [row] = await tx
    .select()
    .from(affiliateCommission)
    .where(eq(affiliateCommission.orderId, orderId))
  return row ?? null
}

/**
 * Credits an order to its affiliate, once. Runs on `order.paid` and again on
 * `order.delivered` (cash on delivery is paid at the door), so it is idempotent: an order
 * with a commission keeps it. Test, imported, draft and cancelled orders earn nothing; a
 * self-referral is recorded reversed so the merchant sees it, and nobody is emailed.
 * `settings` are the store-wide ones; the rates come from the affiliate's program.
 */
export async function creditOrder(
  tx: StoreTx,
  storeId: string,
  orderId: string,
  settings: StoreAffiliateSettings,
  secret: string,
): Promise<CommissionRow | null> {
  const existing = await commissionForOrder(tx, orderId)
  if (existing) return existing
  if (!settings.active) return null
  const [o] = await tx.select().from(order).where(eq(order.id, orderId))
  if (!o || o.isTest || o.importedFrom || o.status === 'cancelled' || o.status === 'draft') {
    return null
  }
  const match = await matchAffiliate(tx, storeId, o, settings)
  if (!match) return null
  const rules = match.settings
  if (
    match.source !== 'lifetime' &&
    rules.scope === 'first_order' &&
    (await earlierOrders(tx, o)) > 0
  ) {
    return null
  }
  const tier = tierFor(rules.tiers, await approvedSales(tx, match.affiliate.id))
  const result = computeCommission(
    {
      subtotalPaise: o.subtotalPaise,
      // A payment-method discount (prepaid offer) is money the shopper did not pay, like a
      // code; a COD fee is not a sale. The same reduction the GST split uses.
      discountPaise: o.discountPaise + Math.max(0, -o.paymentAdjustmentPaise),
      lines: await commissionLines(tx, orderId),
    },
    rules,
    tier,
    match.affiliate.rateOverride ?? null,
  )
  if (result.commissionPaise <= 0) return null
  const finding = await fraudCheck(tx, match.affiliate, o, secret)
  // Not their own order, but risky: held (pending with a flag) until the merchant decides.
  const risk = finding ? null : await orderRisk(tx, o, match, settings, secret)
  const now = new Date()
  const [row] = await tx
    .insert(affiliateCommission)
    .values({
      storeId,
      affiliateId: match.affiliate.id,
      orderId,
      customerId: o.customerId,
      programId: match.programId,
      source: match.source,
      status: finding ? 'reversed' : 'pending',
      basePaise: result.basePaise,
      earnedPaise: result.commissionPaise,
      commissionPaise: result.commissionPaise,
      flag: finding ?? risk,
      placedAt: o.placedAt,
      ...(finding ? { reversedAt: now, reversedReason: 'self_referral' } : {}),
    })
    .onConflictDoNothing()
    .returning()
  if (!row) return commissionForOrder(tx, orderId)
  if (!finding) {
    await insertOutboxEvent(tx, storeId, 'affiliate.commission_created', {
      affiliateId: row.affiliateId,
      commissionId: row.id,
      orderId,
    })
  }
  return row
}

/** Delivery starts the hold; a commission becomes payable `holdDays` later. */
export async function startHold(
  tx: StoreTx,
  orderId: string,
  settings: StoreAffiliateSettings,
  now = new Date(),
): Promise<CommissionRow | null> {
  const [o] = await tx
    .select({ deliveredAt: order.deliveredAt })
    .from(order)
    .where(eq(order.id, orderId))
  const delivered = o?.deliveredAt ?? now
  const [row] = await tx
    .update(affiliateCommission)
    .set({
      deliveredAt: delivered,
      eligibleAt: eligibleAt(delivered, settings.holdDays),
      updatedAt: now,
    })
    .where(
      and(
        eq(affiliateCommission.orderId, orderId),
        eq(affiliateCommission.status, 'pending'),
        isNull(affiliateCommission.deliveredAt),
      ),
    )
    .returning()
  return row ?? null
}

/**
 * Cancel, RTO, a full refund or the merchant: the commission is never paid. One already in a
 * payout (paid, or waiting to be paid) cannot be taken out of it, so the money becomes a
 * clawback the affiliate's next payout recovers.
 */
export async function reverseCommission(
  tx: StoreTx,
  storeId: string,
  orderId: string,
  reason: ReverseReason,
): Promise<CommissionRow | null> {
  const current = await commissionForOrder(tx, orderId)
  if (!current || current.status === 'reversed') return null
  const inPayout = Boolean(current.payoutId)
  if (!inPayout && !canReverse(current.status)) return null
  const [row] = await tx
    .update(affiliateCommission)
    .set({
      status: 'reversed',
      reversedAt: new Date(),
      reversedReason: reason,
      updatedAt: new Date(),
      ...(inPayout ? { clawbackPaise: current.clawbackPaise + current.commissionPaise } : {}),
    })
    .where(eq(affiliateCommission.id, current.id))
    .returning()
  if (row) {
    await insertOutboxEvent(tx, storeId, 'affiliate.commission_reversed', {
      affiliateId: row.affiliateId,
      commissionId: row.id,
      orderId,
    })
  }
  return row ?? null
}

/**
 * What a refund is measured against: the goods the shopper paid for, without shipping and a
 * payment-method fee. Refunds come off the goods first, so refunding every item reverses the
 * commission even when the shipping charge was kept.
 */
export function goodsPaidPaise(
  o: Pick<OrderRow, 'totalPaise' | 'shippingPaise' | 'paymentAdjustmentPaise'>,
): number {
  return Math.max(0, o.totalPaise - o.shippingPaise - Math.max(0, o.paymentAdjustmentPaise))
}

/**
 * Money refunded on the order that counts against the commission. An order edit's refunds do
 * not: the edit already lowered the order's total, and the commission is recomputed from the
 * edited lines (`commission-edit.ts`), so counting them would take the same money off twice.
 */
export async function refundedForCommission(tx: StoreTx, orderId: string): Promise<number> {
  const [r] = await tx
    .select({ s: sql<number>`coalesce(sum(${refund.amountPaise}), 0)::int` })
    .from(refund)
    .where(
      and(
        eq(refund.orderId, orderId),
        ne(refund.status, 'failed'),
        sql`${refund.reason} is distinct from ${ORDER_EDIT_REFUND_REASON}`,
      ),
    )
  return r?.s ?? 0
}

/**
 * A refund shrinks the commission by the share of the goods paid back; all of them reverses it.
 */
export async function applyRefunds(
  tx: StoreTx,
  storeId: string,
  orderId: string,
): Promise<CommissionRow | null> {
  const current = await commissionForOrder(tx, orderId)
  if (!current || current.status === 'reversed') return null
  if (!current.payoutId && !canReverse(current.status)) return null
  const [o] = await tx
    .select({
      totalPaise: order.totalPaise,
      shippingPaise: order.shippingPaise,
      paymentAdjustmentPaise: order.paymentAdjustmentPaise,
    })
    .from(order)
    .where(eq(order.id, orderId))
  const goods = o ? goodsPaidPaise(o) : 0
  const refunded = await refundedForCommission(tx, orderId)
  if (refunded > 0 && refunded >= goods) return reverseCommission(tx, storeId, orderId, 'refunded')
  const next = Math.min(
    current.commissionPaise,
    scaleForRefund(current.earnedPaise, goods, refunded),
  )
  // Already in a payout: the part refunded since is recovered from the next payout.
  const clawback = current.payoutId ? current.commissionPaise - next : 0
  // Not in a payout yet: the TDS deducted at approval follows the smaller credit.
  const tdsPaise =
    !current.payoutId && current.commissionPaise > 0
      ? Math.round((current.tdsPaise * next) / current.commissionPaise)
      : current.tdsPaise
  const [row] = await tx
    .update(affiliateCommission)
    .set({
      commissionPaise: next,
      tdsPaise,
      clawbackPaise: current.clawbackPaise + clawback,
      updatedAt: new Date(),
    })
    .where(eq(affiliateCommission.id, current.id))
    .returning()
  return row ?? null
}

/** Why a due commission must not be approved after all: the order changed under it. */
function lateReversal(o: Pick<OrderRow, 'status' | 'fulfillmentStatus' | 'paymentStatus'>) {
  if (o.status === 'cancelled') return 'cancelled' as const
  if (o.fulfillmentStatus === 'returned') return 'rto' as const
  if (o.paymentStatus === 'refunded') return 'refunded' as const
  return null
}

/**
 * Approves every commission whose hold is over, deducting TDS for the financial year so far
 * (credit time). Re-reads each order first, so a cancel or return no hook saw still reverses.
 */
/** How many commissions "Approve due now" would act on: pending, not flagged, hold over. */
export async function countDueCommissions(tx: StoreTx, now = new Date()): Promise<number> {
  const [row] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(affiliateCommission)
    .where(
      and(
        eq(affiliateCommission.status, 'pending'),
        isNull(affiliateCommission.flag),
        lte(affiliateCommission.eligibleAt, now),
      ),
    )
  return row?.n ?? 0
}

export async function approveDueCommissions(
  tx: StoreTx,
  storeId: string,
  settings: StoreAffiliateSettings,
  now = new Date(),
): Promise<{ approved: number; reversed: number }> {
  const due = await tx
    .select()
    .from(affiliateCommission)
    .where(
      and(
        eq(affiliateCommission.status, 'pending'),
        isNull(affiliateCommission.flag),
        lte(affiliateCommission.eligibleAt, now),
      ),
    )
    .orderBy(asc(affiliateCommission.eligibleAt))
    .limit(500)
  const counts = { approved: 0, reversed: 0 }
  const fyStart = financialYearStart(now)
  for (const c of due) {
    if (!isDue(c, now)) continue
    const [o] = await tx
      .select({
        status: order.status,
        fulfillmentStatus: order.fulfillmentStatus,
        paymentStatus: order.paymentStatus,
      })
      .from(order)
      .where(eq(order.id, c.orderId))
    const late = o ? lateReversal(o) : 'cancelled'
    if (late) {
      if (await reverseCommission(tx, storeId, c.orderId, late)) counts.reversed++
      continue
    }
    const [a] = await tx
      .select({ hasPan: affiliate.hasPan })
      .from(affiliate)
      .where(eq(affiliate.id, c.affiliateId))
    const [year] = await tx
      .select({
        credited: sql<number>`coalesce(sum(${affiliateCommission.commissionPaise}), 0)::int`,
        tds: sql<number>`coalesce(sum(${affiliateCommission.tdsPaise}), 0)::int`,
      })
      .from(affiliateCommission)
      .where(
        and(
          eq(affiliateCommission.affiliateId, c.affiliateId),
          inArray(affiliateCommission.status, ['approved', 'paid']),
          gte(affiliateCommission.approvedAt, fyStart),
        ),
      )
    const tdsPaise = tdsForCredit({
      settings: settings.tds,
      yearCreditedPaise: year?.credited ?? 0,
      yearTdsPaise: year?.tds ?? 0,
      creditPaise: c.commissionPaise,
      hasPan: a?.hasPan ?? false,
    })
    const [row] = await tx
      .update(affiliateCommission)
      .set({ status: 'approved', approvedAt: now, tdsPaise, updatedAt: now })
      .where(and(eq(affiliateCommission.id, c.id), eq(affiliateCommission.status, 'pending')))
      .returning({ id: affiliateCommission.id })
    if (!row) continue
    counts.approved++
    await insertOutboxEvent(tx, storeId, 'affiliate.commission_approved', {
      affiliateId: c.affiliateId,
      commissionId: c.id,
      orderId: c.orderId,
    })
  }
  return counts
}

/**
 * The merchant's call on one commission: `clear` lifts a fraud flag (the commission goes back
 * to pending, or comes back from a self-referral reversal), `reverse` refuses it.
 */
export async function decideCommission(
  tx: StoreTx,
  storeId: string,
  id: string,
  decision: 'clear' | 'reverse',
  settings: StoreAffiliateSettings,
): Promise<CommissionRow | null> {
  const [c] = await tx.select().from(affiliateCommission).where(eq(affiliateCommission.id, id))
  if (!c) return null
  if (decision === 'reverse') return reverseCommission(tx, storeId, c.orderId, 'manual')
  if (c.payoutId || c.status === 'paid' || c.status === 'approved') return c
  if (c.status === 'reversed' && c.reversedReason !== 'self_referral') return c
  const [row] = await tx
    .update(affiliateCommission)
    .set({
      status: 'pending',
      flag: null,
      reversedAt: null,
      reversedReason: null,
      updatedAt: new Date(),
    })
    .where(eq(affiliateCommission.id, id))
    .returning()
  if (!row) return null
  // Already delivered while it was flagged: the hold starts now.
  const [o] = await tx
    .select({ f: order.fulfillmentStatus })
    .from(order)
    .where(eq(order.id, row.orderId))
  if (o?.f === 'delivered' && !row.deliveredAt)
    return (await startHold(tx, row.orderId, settings)) ?? row
  return row
}
