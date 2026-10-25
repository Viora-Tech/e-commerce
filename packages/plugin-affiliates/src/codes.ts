/** SOURCE OF TRUTH: affiliate codes — WHAT: every link code and coupon an affiliate has had (`affiliate_code`), the personal coupon made in the discount engine, rotating a leaked coupon, and an affiliate's request for their own code / WHY: old posts must keep earning after a code changes, while a leaked coupon must stop working (design §4 codes table) */
import { normaliseCode } from '@commerce/core'
import { discount, type StoreTx } from '@commerce/db'
import { and, desc, eq, inArray, or, type SQL, sql } from 'drizzle-orm'
import { programOf } from './programs'
import { affiliate, affiliateCode } from './schema'
import type { ProgramRules } from './settings'
import { AffiliateError } from './store-settings'

type AffiliateRow = typeof affiliate.$inferSelect

/** A code an affiliate may ask for: 3 to 24 letters, digits and dashes. */
const CODE_PATTERN = /^[a-z0-9][a-z0-9-]{2,23}$/

/** Notes a code in the affiliate's history; recording one twice is a no-op. */
export async function recordCode(
  tx: StoreTx,
  storeId: string,
  affiliateId: string,
  kind: 'link' | 'coupon',
  code: string,
  discountId: string | null = null,
): Promise<void> {
  await tx
    .insert(affiliateCode)
    .values({ storeId, affiliateId, kind, code, discountId })
    .onConflictDoNothing()
}

/**
 * The affiliate a `?ref=` code belongs to: their current code, or one they had before (retired
 * link codes keep earning, so old posts still pay).
 */
export function linkCodeIs(code: string): SQL {
  return or(
    eq(affiliate.code, code),
    inArray(
      affiliate.id,
      sql`(select ${affiliateCode.affiliateId} from ${affiliateCode} where ${affiliateCode.kind} = 'link' and ${affiliateCode.code} = ${code})`,
    ),
  ) as SQL
}

/** The affiliate's personal code in the discount engine; made once, never twice. */
export async function ensureCoupon(
  tx: StoreTx,
  storeId: string,
  row: AffiliateRow,
  coupon: ProgramRules['coupon'],
): Promise<AffiliateRow> {
  if (!coupon.enabled || row.discountId) return row
  let code = normaliseCode(row.code)
  for (let n = 2; n < 50; n++) {
    const [clash] = await tx
      .select({ id: discount.id })
      .from(discount)
      .where(eq(discount.code, code))
    if (!clash) break
    code = normaliseCode(`${row.code}${n}`)
  }
  const [made] = await tx
    .insert(discount)
    .values({
      storeId,
      title: `Affiliate: ${row.name || row.code}`.slice(0, 120),
      kind: 'code',
      code,
      method: 'percent',
      value: coupon.bp,
      appliesTo: 'all',
      appliesToIds: [],
      status: 'active',
    })
    .returning({ id: discount.id })
  if (!made) return row
  await recordCode(tx, storeId, row.id, 'coupon', code, made.id)
  const [next] = await tx
    .update(affiliate)
    .set({ discountId: made.id, couponCode: code, updatedAt: new Date() })
    .where(eq(affiliate.id, row.id))
    .returning()
  return next ?? row
}

async function retireCoupon(tx: StoreTx, row: AffiliateRow): Promise<void> {
  if (!row.discountId) return
  await tx
    .update(discount)
    .set({ status: 'disabled', updatedAt: new Date() })
    .where(eq(discount.id, row.discountId))
  await tx
    .update(affiliateCode)
    .set({ status: 'retired', retiredAt: new Date() })
    .where(and(eq(affiliateCode.kind, 'coupon'), eq(affiliateCode.discountId, row.discountId)))
}

async function loadAffiliate(tx: StoreTx, id: string): Promise<AffiliateRow> {
  const [row] = await tx.select().from(affiliate).where(eq(affiliate.id, id))
  if (!row) throw new AffiliateError('AFFILIATE_NOT_FOUND', 'Affiliate not found')
  return row
}

/**
 * A leaked coupon: the old one stops working (its discount is disabled) and a new one is made
 * at the program's value. The referral link is untouched.
 */
export async function rotateCoupon(
  tx: StoreTx,
  storeId: string,
  id: string,
): Promise<AffiliateRow> {
  const row = await loadAffiliate(tx, id)
  if (row.status !== 'approved') {
    throw new AffiliateError('AFFILIATE_NOT_APPROVED', 'Only approved affiliates have a code')
  }
  await retireCoupon(tx, row)
  const [cleared] = await tx
    .update(affiliate)
    .set({ discountId: null, couponCode: null, updatedAt: new Date() })
    .where(eq(affiliate.id, id))
    .returning()
  const program = await programOf(tx, storeId, cleared ?? row)
  return ensureCoupon(tx, storeId, cleared ?? row, program.rules.coupon)
}

/** Whether a code is free in this store: no affiliate has (or had) it and no discount uses it. */
async function codeTaken(tx: StoreTx, storeId: string, code: string): Promise<boolean> {
  const [own] = await tx
    .select({ id: affiliate.id })
    .from(affiliate)
    .where(and(eq(affiliate.storeId, storeId), linkCodeIs(code)))
    .limit(1)
  if (own) return true
  const [used] = await tx
    .select({ id: discount.id })
    .from(discount)
    .where(eq(discount.code, normaliseCode(code)))
    .limit(1)
  return Boolean(used)
}

export type CodeRequest = { code: string; at: string; status: 'pending' | 'approved' | 'declined' }

/** The affiliate asks for their own code (`asha` instead of `asha-k2`); the merchant decides. */
export async function requestCode(
  tx: StoreTx,
  storeId: string,
  id: string,
  wanted: string,
): Promise<CodeRequest> {
  const code = wanted.trim().toLowerCase()
  if (!CODE_PATTERN.test(code)) {
    throw new AffiliateError('CODE_INVALID', 'Use 3 to 24 letters, numbers and dashes')
  }
  const row = await loadAffiliate(tx, id)
  if (row.status !== 'approved') {
    throw new AffiliateError('AFFILIATE_NOT_APPROVED', 'Only approved affiliates have a code')
  }
  if (code === row.code) throw new AffiliateError('CODE_TAKEN', 'That is already your code')
  if (await codeTaken(tx, storeId, code)) {
    throw new AffiliateError('CODE_TAKEN', 'That code is taken. Try another.')
  }
  const request: CodeRequest = { code, at: new Date().toISOString(), status: 'pending' }
  await tx
    .update(affiliate)
    .set({ codeRequest: request, updatedAt: new Date() })
    .where(eq(affiliate.id, id))
  return request
}

/**
 * The merchant's call on a code request. Approving makes it the affiliate's link code (the old
 * one keeps earning) and replaces their coupon with one made from it.
 */
export async function decideCodeRequest(
  tx: StoreTx,
  storeId: string,
  id: string,
  decision: 'approve' | 'decline',
): Promise<AffiliateRow> {
  const row = await loadAffiliate(tx, id)
  const request = row.codeRequest
  if (request?.status !== 'pending') {
    throw new AffiliateError('NO_CODE_REQUEST', 'There is no code request waiting')
  }
  if (decision === 'decline') {
    const [next] = await tx
      .update(affiliate)
      .set({ codeRequest: { ...request, status: 'declined' }, updatedAt: new Date() })
      .where(eq(affiliate.id, id))
      .returning()
    return next ?? row
  }
  if (await codeTaken(tx, storeId, request.code)) {
    throw new AffiliateError('CODE_TAKEN', 'That code was taken in the meantime')
  }
  await recordCode(tx, storeId, row.id, 'link', row.code)
  await tx
    .update(affiliateCode)
    .set({ status: 'retired', retiredAt: new Date() })
    .where(
      and(
        eq(affiliateCode.affiliateId, row.id),
        eq(affiliateCode.kind, 'link'),
        eq(affiliateCode.code, row.code),
      ),
    )
  await recordCode(tx, storeId, row.id, 'link', request.code)
  await retireCoupon(tx, row)
  const [renamed] = await tx
    .update(affiliate)
    .set({
      code: request.code,
      codeRequest: { ...request, status: 'approved' },
      discountId: null,
      couponCode: null,
      updatedAt: new Date(),
    })
    .where(eq(affiliate.id, id))
    .returning()
  const next = renamed ?? row
  const program = await programOf(tx, storeId, next)
  return ensureCoupon(tx, storeId, next, program.rules.coupon)
}

export type CodeHistoryItem = {
  kind: 'link' | 'coupon'
  code: string
  status: 'active' | 'retired'
  createdAt: Date
  retiredAt: Date | null
}

/** Every code the affiliate has had, newest first. */
export async function listCodes(tx: StoreTx, affiliateId: string): Promise<CodeHistoryItem[]> {
  return tx
    .select({
      kind: affiliateCode.kind,
      code: affiliateCode.code,
      status: affiliateCode.status,
      createdAt: affiliateCode.createdAt,
      retiredAt: affiliateCode.retiredAt,
    })
    .from(affiliateCode)
    .where(eq(affiliateCode.affiliateId, affiliateId))
    .orderBy(desc(affiliateCode.createdAt))
}
