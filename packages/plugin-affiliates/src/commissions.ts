/** SOURCE OF TRUTH: affiliate commissions — WHAT: which affiliate an order earns for, the hold, approval with TDS, reversals / WHY: order events (paid, delivered, cancelled, RTO, refund) all land here */
import { insertOutboxEvent, phoneBlindIndex } from '@commerce/core'
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

async function commissionLines(tx: StoreTx, orderId: string): Promise<CommissionLine[]> {
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
async function approvedSales(tx: StoreTx, affiliateId: string): Promise<number> {
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
      discountPaise: o.discountPaise,
      lines: await commissionLines(tx, orderId),
    },
    rules,
    tier,
    match.affiliate.rateOverride ?? null,
  )
  if (result.commissionPaise <= 0) return null
  const finding = await fraudCheck(tx, match.affiliate, o, secret)
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
      flag: finding,
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

/** A refund shrinks the commission by the share of the order paid back; all of it reverses it. */
export async function applyRefunds(
  tx: StoreTx,
  storeId: string,
  orderId: string,
): Promise<CommissionRow | null> {
  const current = await commissionForOrder(tx, orderId)
  if (!current || current.status === 'reversed') return null
  if (!current.payoutId && !canReverse(current.status)) return null
  const [o] = await tx.select({ total: order.totalPaise }).from(order).where(eq(order.id, orderId))
  const [r] = await tx
    .select({ s: sql<number>`coalesce(sum(${refund.amountPaise}), 0)::int` })
    .from(refund)
    .where(and(eq(refund.orderId, orderId), ne(refund.status, 'failed')))
  const total = o?.total ?? 0
  const refunded = r?.s ?? 0
  if (refunded >= total) return reverseCommission(tx, storeId, orderId, 'refunded')
  const next = Math.min(
    current.commissionPaise,
    scaleForRefund(current.earnedPaise, total, refunded),
  )
  // Already in a payout: the part refunded since is recovered from the next payout.
  const clawback = current.payoutId ? current.commissionPaise - next : 0
  const [row] = await tx
    .update(affiliateCommission)
    .set({
      commissionPaise: next,
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
