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
import { and, asc, eq, gte, inArray, isNull, lte, ne, notInArray, or, sql } from 'drizzle-orm'
import { type CommissionLine, computeCommission, scaleForRefund, tierFor } from './commission'
import { addressKey, type FraudFinding, phoneKey, selfReferral } from './fraud'
import {
  canReverse,
  eligibleAt,
  type ReverseReason,
  withinCookieWindow,
  withinLifetime,
} from './hold'
import { affiliate, affiliateCommission } from './schema'
import type { AffiliateSettings } from './settings'
import { financialYearStart, tdsForCredit } from './tds'

export type CommissionRow = typeof affiliateCommission.$inferSelect
type AffiliateRow = typeof affiliate.$inferSelect
type OrderRow = typeof order.$inferSelect

async function approvedAffiliateBy(
  tx: StoreTx,
  storeId: string,
  where: ReturnType<typeof eq>,
): Promise<AffiliateRow | null> {
  const [row] = await tx
    .select()
    .from(affiliate)
    .where(and(eq(affiliate.storeId, storeId), eq(affiliate.status, 'approved'), where))
  return row ?? null
}

/** Earlier live orders by the same customer (account, else email), for first-order programs. */
async function earlierOrders(tx: StoreTx, o: OrderRow): Promise<number> {
  const who = o.customerId
    ? eq(order.customerId, o.customerId)
    : o.email
      ? sql`lower(${order.email}) = ${o.email.toLowerCase()}`
      : null
  if (!who) return 0
  const [r] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(order)
    .where(
      and(
        who,
        ne(order.id, o.id),
        sql`${order.placedAt} < ${o.placedAt.toISOString()}::timestamptz`,
        notInArray(order.status, ['cancelled', 'draft']),
        eq(order.isTest, false),
      ),
    )
  return r?.n ?? 0
}

type Match = { affiliate: AffiliateRow; source: 'link' | 'coupon' | 'lifetime' }

/** Coupon first (the shopper typed it), then the referral link inside the cookie window, then lifetime. */
async function matchAffiliate(
  tx: StoreTx,
  storeId: string,
  o: OrderRow,
  settings: AffiliateSettings,
): Promise<Match | null> {
  if (o.discountCode) {
    const a = await approvedAffiliateBy(tx, storeId, eq(affiliate.couponCode, o.discountCode))
    if (a) return { affiliate: a, source: 'coupon' }
  }
  const ref = o.attribution?.ref
  if (ref && o.attribution?.at) {
    const touched = new Date(o.attribution.at)
    if (withinCookieWindow(touched, o.placedAt, settings.cookieDays)) {
      const a = await approvedAffiliateBy(tx, storeId, eq(affiliate.code, ref))
      if (a) return { affiliate: a, source: 'link' }
    }
  }
  if (settings.scope === 'lifetime' && o.customerId) {
    const [first] = await tx
      .select({
        affiliateId: affiliateCommission.affiliateId,
        placedAt: affiliateCommission.placedAt,
      })
      .from(affiliateCommission)
      .where(
        and(
          eq(affiliateCommission.customerId, o.customerId),
          or(
            isNull(affiliateCommission.reversedReason),
            ne(affiliateCommission.reversedReason, 'self_referral'),
          ),
        ),
      )
      .orderBy(asc(affiliateCommission.placedAt))
      .limit(1)
    if (first && withinLifetime(first.placedAt, o.placedAt, settings.lifetimeDays)) {
      const a = await approvedAffiliateBy(tx, storeId, eq(affiliate.id, first.affiliateId))
      if (a) return { affiliate: a, source: 'lifetime' }
    }
  }
  return null
}

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
 */
export async function creditOrder(
  tx: StoreTx,
  storeId: string,
  orderId: string,
  settings: AffiliateSettings,
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
  if (
    match.source !== 'lifetime' &&
    settings.scope === 'first_order' &&
    (await earlierOrders(tx, o)) > 0
  ) {
    return null
  }
  const tier = tierFor(settings.tiers, await approvedSales(tx, match.affiliate.id))
  const result = computeCommission(
    {
      subtotalPaise: o.subtotalPaise,
      discountPaise: o.discountPaise,
      lines: await commissionLines(tx, orderId),
    },
    settings,
    tier,
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
  settings: AffiliateSettings,
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

/** Cancel, RTO, a full refund or the merchant: the commission is never paid. Paid ones stay paid. */
export async function reverseCommission(
  tx: StoreTx,
  storeId: string,
  orderId: string,
  reason: ReverseReason,
): Promise<CommissionRow | null> {
  const current = await commissionForOrder(tx, orderId)
  if (!current || !canReverse(current.status) || current.payoutId) return null
  const [row] = await tx
    .update(affiliateCommission)
    .set({
      status: 'reversed',
      reversedAt: new Date(),
      reversedReason: reason,
      updatedAt: new Date(),
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
  if (!current || !canReverse(current.status) || current.payoutId) return null
  const [o] = await tx.select({ total: order.totalPaise }).from(order).where(eq(order.id, orderId))
  const [r] = await tx
    .select({ s: sql<number>`coalesce(sum(${refund.amountPaise}), 0)::int` })
    .from(refund)
    .where(and(eq(refund.orderId, orderId), ne(refund.status, 'failed')))
  const total = o?.total ?? 0
  const refunded = r?.s ?? 0
  if (refunded >= total) return reverseCommission(tx, storeId, orderId, 'refunded')
  const next = scaleForRefund(current.earnedPaise, total, refunded)
  const [row] = await tx
    .update(affiliateCommission)
    .set({ commissionPaise: next, updatedAt: new Date() })
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
  settings: AffiliateSettings,
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
  settings: AffiliateSettings,
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
