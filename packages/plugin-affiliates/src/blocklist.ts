/** SOURCE OF TRUTH: affiliate fraud checks with the database — WHAT: the store's blocklist (add, list, remove, match), the order risk that holds a commission (blocked buyer, a code from a coupon site, a coupon spike), and the affiliate review (a PAN or payee shared with another affiliate, or blocked) / WHY: flag-and-hold: nothing is refused silently at payout time, the merchant clears or reverses (design §4 fraud) */
import { createHmac } from 'node:crypto'
import { encryptSecret } from '@commerce/core'
import type { order, StoreTx } from '@commerce/db'
import { and, desc, eq, gte, inArray, lt, ne, sql } from 'drizzle-orm'
import {
  type BlocklistKind,
  blocklistHint,
  blocklistKey,
  isCouponSite,
  isCouponSpike,
  type OrderRisk,
  phoneKey,
  type ReviewReason,
  referrerHost,
} from './fraud'
import { affiliate, affiliateBlocklist, affiliateCommission } from './schema'
import type { StoreAffiliateSettings } from './settings'
import { AffiliateError } from './store-settings'

type AffiliateRow = typeof affiliate.$inferSelect
type OrderRow = typeof order.$inferSelect

/** HMAC of a normalised value under the settings key, one key space per kind. */
export function fraudIndex(kind: BlocklistKind, key: string, secret: string): string {
  return createHmac('sha256', secret).update(`affiliate-${kind}:${key}`).digest('hex')
}

export type BlocklistEntry = {
  id: string
  kind: BlocklistKind
  hint: string
  note: string
  createdAt: Date
}

/** Newest first. Values stay encrypted; only the masked hint leaves the database. */
export async function listBlocklist(tx: StoreTx): Promise<BlocklistEntry[]> {
  return tx
    .select({
      id: affiliateBlocklist.id,
      kind: affiliateBlocklist.kind,
      hint: affiliateBlocklist.hint,
      note: affiliateBlocklist.note,
      createdAt: affiliateBlocklist.createdAt,
    })
    .from(affiliateBlocklist)
    .orderBy(desc(affiliateBlocklist.createdAt))
}

/** Adds a value; adding one already there returns the existing entry. */
export async function addToBlocklist(
  tx: StoreTx,
  storeId: string,
  input: { kind: BlocklistKind; value: string; note: string },
  userId: string | null,
  secret: string,
): Promise<BlocklistEntry> {
  const key = blocklistKey(input.kind, input.value)
  if (!key) throw new AffiliateError('BLOCKLIST_INVALID', 'Enter a valid value for this kind')
  const valueIndex = fraudIndex(input.kind, key, secret)
  await tx
    .insert(affiliateBlocklist)
    .values({
      storeId,
      kind: input.kind,
      value: encryptSecret(key, secret),
      valueIndex,
      hint: blocklistHint(input.kind, key),
      note: input.note.trim().slice(0, 200),
      createdBy: userId,
    })
    .onConflictDoNothing()
  const [row] = await tx
    .select()
    .from(affiliateBlocklist)
    .where(
      and(eq(affiliateBlocklist.kind, input.kind), eq(affiliateBlocklist.valueIndex, valueIndex)),
    )
  if (!row) throw new AffiliateError('BLOCKLIST_INVALID', 'Not saved')
  return { id: row.id, kind: row.kind, hint: row.hint, note: row.note, createdAt: row.createdAt }
}

export async function removeFromBlocklist(tx: StoreTx, id: string): Promise<void> {
  await tx.delete(affiliateBlocklist).where(eq(affiliateBlocklist.id, id))
}

/** Which of these values are on the blocklist. Values that do not normalise are skipped. */
export async function blockedKinds(
  tx: StoreTx,
  secret: string,
  values: Partial<Record<BlocklistKind, string | null | undefined>>,
): Promise<Set<BlocklistKind>> {
  const wanted = Object.entries(values).flatMap(([kind, raw]) => {
    const k = kind as BlocklistKind
    const key = raw ? blocklistKey(k, raw) : null
    return key ? [{ kind: k, index: fraudIndex(k, key, secret) }] : []
  })
  if (wanted.length === 0) return new Set()
  const rows = await tx
    .select({ kind: affiliateBlocklist.kind, index: affiliateBlocklist.valueIndex })
    .from(affiliateBlocklist)
    .where(
      inArray(
        affiliateBlocklist.valueIndex,
        wanted.map((w) => w.index),
      ),
    )
  return new Set(
    rows
      .filter((r) => wanted.some((w) => w.kind === r.kind && w.index === r.index))
      .map((r) => r.kind),
  )
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Coupon orders credited to the affiliate in the last 24 hours, and per day for the 28 before. */
async function couponCounts(
  tx: StoreTx,
  affiliateId: string,
  placedAt: Date,
): Promise<{ last24h: number; daily: number[] }> {
  const from = new Date(placedAt.getTime() - 29 * DAY_MS)
  const rows = await tx
    .select({ placedAt: affiliateCommission.placedAt })
    .from(affiliateCommission)
    .where(
      and(
        eq(affiliateCommission.affiliateId, affiliateId),
        eq(affiliateCommission.source, 'coupon'),
        gte(affiliateCommission.placedAt, from),
        lt(affiliateCommission.placedAt, placedAt),
      ),
    )
  const daily = Array.from({ length: 28 }, () => 0)
  let last24h = 1 // this order
  for (const r of rows) {
    const ago = placedAt.getTime() - r.placedAt.getTime()
    if (ago < DAY_MS) last24h += 1
    else {
      const day = Math.floor(ago / DAY_MS) - 1
      if (day >= 0 && day < 28) daily[day] = (daily[day] ?? 0) + 1
    }
  }
  return { last24h, daily }
}

/**
 * Why a matched order's commission should wait for the merchant, or null. A buyer on the
 * blocklist; a coupon order with no click on the affiliate's link that came from a coupon site
 * (only known with the shopper's analytics consent); a coupon spike.
 */
export async function orderRisk(
  tx: StoreTx,
  o: OrderRow,
  match: { affiliate: AffiliateRow; source: 'link' | 'coupon' | 'lifetime' },
  settings: StoreAffiliateSettings,
  secret: string,
): Promise<OrderRisk | null> {
  const domain = o.email?.split('@')[1] ?? null
  const blocked = await blockedKinds(tx, secret, {
    email: o.email,
    email_domain: domain,
    phone: o.phone,
  })
  if (blocked.size > 0) return 'blocked_buyer'
  if (match.source !== 'coupon') return null
  const clicked = o.attribution?.ref === match.affiliate.code
  if (!clicked && isCouponSite(referrerHost(o.attribution?.referrer), settings.fraud.couponSites)) {
    return 'coupon_leak_site'
  }
  const { last24h, daily } = await couponCounts(tx, match.affiliate.id, o.placedAt)
  return isCouponSpike(last24h, daily, settings.fraud.spikeMultiple) ? 'coupon_spike' : null
}

/** A PAN and payee key from payout details: the UPI id, or `account@ifsc`. */
export function payoutKeys(details: {
  method: 'upi' | 'bank'
  pan?: string | undefined
  upiId?: string | undefined
  accountNumber?: string | undefined
  ifsc?: string | undefined
}): { pan: string | null; payee: string | null } {
  const payee =
    details.method === 'upi'
      ? (details.upiId ?? null)
      : details.accountNumber && details.ifsc
        ? `${details.accountNumber}@${details.ifsc}`
        : null
  return {
    pan: details.pan ? blocklistKey('pan', details.pan) : null,
    payee: payee ? blocklistKey('payee', payee) : null,
  }
}

/**
 * Re-reads why an affiliate needs review: another affiliate of the store with the same PAN or
 * payee, or their phone, PAN or payee on the blocklist. Called when their payout details or
 * phone change; the merchant's "Looks fine" clears it until the next change.
 */
export async function refreshReview(
  tx: StoreTx,
  row: AffiliateRow,
  extra: { phone?: string | null | undefined; pan?: string | null; payee?: string | null },
  secret: string,
): Promise<ReviewReason[]> {
  const reasons: ReviewReason[] = []
  // The other affiliates with the same value get the reason too: either could be the copy.
  const shared = async (
    column: typeof affiliate.panIndex | typeof affiliate.payeeIndex,
    index: string | null,
    reason: ReviewReason,
  ) => {
    if (!index) return false
    const others = await tx
      .update(affiliate)
      .set({
        reviewReasons: sql`case when ${affiliate.reviewReasons} ? ${reason} then ${affiliate.reviewReasons} else ${affiliate.reviewReasons} || ${JSON.stringify([reason])}::jsonb end`,
        updatedAt: new Date(),
      })
      .where(and(eq(column, index), ne(affiliate.id, row.id)))
      .returning({ id: affiliate.id })
    return others.length > 0
  }
  if (await shared(affiliate.panIndex, row.panIndex, 'duplicate_pan')) reasons.push('duplicate_pan')
  if (await shared(affiliate.payeeIndex, row.payeeIndex, 'duplicate_payee'))
    reasons.push('duplicate_payee')
  const blocked = await blockedKinds(tx, secret, {
    phone: extra.phone ? phoneKey(extra.phone) : null,
    pan: extra.pan ?? null,
    payee: extra.payee ?? null,
  })
  if (blocked.has('phone')) reasons.push('blocked_phone')
  if (blocked.has('pan')) reasons.push('blocked_pan')
  if (blocked.has('payee')) reasons.push('blocked_payee')
  await tx
    .update(affiliate)
    .set({ reviewReasons: reasons, updatedAt: new Date() })
    .where(eq(affiliate.id, row.id))
  return reasons
}

/** The merchant looked and it is fine: payouts go ahead. */
export async function clearReview(tx: StoreTx, id: string): Promise<void> {
  await tx
    .update(affiliate)
    .set({ reviewReasons: sql`'[]'::jsonb`, updatedAt: new Date() })
    .where(eq(affiliate.id, id))
}
