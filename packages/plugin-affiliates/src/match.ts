/** SOURCE OF TRUTH: affiliate order matching — WHAT: which affiliate (and program) an order earns for / WHY: coupon, link and lifetime binding must be checked in one fixed order */
import { order, type StoreTx } from '@commerce/db'
import { and, asc, eq, isNull, ne, notInArray, or, type SQL, sql } from 'drizzle-orm'
import { linkCodeIs } from './codes'
import { withinCookieWindow, withinLifetime } from './hold'
import { programOf } from './programs'
import { affiliate, affiliateCommission } from './schema'
import { type AffiliateSettings, type StoreAffiliateSettings, withProgramRules } from './settings'

type AffiliateRow = typeof affiliate.$inferSelect
type OrderRow = typeof order.$inferSelect

async function approvedAffiliateBy(
  tx: StoreTx,
  storeId: string,
  where: SQL,
): Promise<AffiliateRow | null> {
  const [row] = await tx
    .select()
    .from(affiliate)
    .where(and(eq(affiliate.storeId, storeId), eq(affiliate.status, 'approved'), where))
  return row ?? null
}

/** Earlier live orders by the same customer (account, else email), for first-order programs. */
export async function earlierOrders(tx: StoreTx, o: OrderRow): Promise<number> {
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

type Match = {
  affiliate: AffiliateRow
  source: 'link' | 'coupon' | 'lifetime'
  /** The store's settings with the affiliate's program rules on top. */
  settings: AffiliateSettings
  programId: string
}

/**
 * Coupon first (the shopper typed it), then the referral link inside the cookie window, then
 * lifetime: the customer's first referred order binds them to that affiliate for as long as
 * the affiliate's program says (`scope`, `lifetimeDays`).
 */
export async function matchAffiliate(
  tx: StoreTx,
  storeId: string,
  o: OrderRow,
  settings: StoreAffiliateSettings,
): Promise<Match | null> {
  const found = await matchedAffiliate(tx, storeId, o, settings)
  if (!found) return null
  const program = await programOf(tx, storeId, found.affiliate)
  return {
    ...found,
    settings: withProgramRules(settings, program.rules),
    programId: program.id,
  }
}

async function matchedAffiliate(
  tx: StoreTx,
  storeId: string,
  o: OrderRow,
  settings: StoreAffiliateSettings,
): Promise<Pick<Match, 'affiliate' | 'source'> | null> {
  if (o.discountCode) {
    const a = await approvedAffiliateBy(tx, storeId, eq(affiliate.couponCode, o.discountCode))
    if (a) return { affiliate: a, source: 'coupon' }
  }
  const ref = o.attribution?.ref
  if (ref && o.attribution?.at) {
    const touched = new Date(o.attribution.at)
    if (withinCookieWindow(touched, o.placedAt, settings.cookieDays)) {
      // A retired link code still earns: old posts keep paying.
      const a = await approvedAffiliateBy(tx, storeId, linkCodeIs(ref))
      if (a) return { affiliate: a, source: 'link' }
    }
  }
  if (o.customerId) {
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
    const a = first
      ? await approvedAffiliateBy(tx, storeId, eq(affiliate.id, first.affiliateId))
      : null
    if (first && a) {
      const { rules } = await programOf(tx, storeId, a)
      if (
        rules.scope === 'lifetime' &&
        withinLifetime(first.placedAt, o.placedAt, rules.lifetimeDays)
      ) {
        return { affiliate: a, source: 'lifetime' }
      }
    }
  }
  return null
}
