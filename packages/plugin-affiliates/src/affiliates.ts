/** SOURCE OF TRUTH: affiliates — WHAT: signup, approval, coupon codes, clicks and encrypted payout details / WHY: the admin and the storefront portal share every rule */
import {
  decryptSecret,
  encryptSecret,
  insertOutboxEvent,
  normaliseCode,
  phoneBlindIndex,
} from '@commerce/core'
import { slugify } from '@commerce/core/catalog'
import { discount, type StoreTx } from '@commerce/db'
import { and, desc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { phoneKey } from './fraud'
import { defaultProgram, getProgram, programOf } from './programs'
import { affiliate } from './schema'
import type { AffiliateSettings, AffiliateStatus, ProgramRules } from './settings'
import { AffiliateError } from './store-settings'

export type AffiliateRow = typeof affiliate.$inferSelect

/** What an affiliate types for getting paid. Stored as one encrypted blob, never in the clear. */
export const PayoutDetailsSchema = z.discriminatedUnion('method', [
  z.object({
    method: z.literal('upi'),
    upiId: z
      .string()
      .trim()
      .max(100)
      .regex(/^[\w.-]{2,64}@[a-zA-Z][a-zA-Z0-9.-]{1,40}$/, 'Enter a UPI ID like name@bank'),
    pan: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{5}\d{4}[A-Z]$/, 'Enter a valid PAN')
      .optional(),
  }),
  z.object({
    method: z.literal('bank'),
    accountName: z.string().trim().min(2).max(100),
    accountNumber: z
      .string()
      .trim()
      .regex(/^\d{9,18}$/, 'Enter the account number, digits only'),
    ifsc: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Enter an 11-character IFSC'),
    pan: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{5}\d{4}[A-Z]$/, 'Enter a valid PAN')
      .optional(),
  }),
])
export type PayoutDetails = z.infer<typeof PayoutDetailsSchema>

/** "UPI as•••@okaxis" / "Bank account ending 1234": all the admin and the portal ever show. */
function payoutHint(d: PayoutDetails): string {
  if (d.method === 'upi') {
    const [name = '', bank = ''] = d.upiId.split('@')
    return `UPI ${name.slice(0, 2)}•••@${bank}`
  }
  return `Bank account ending ${d.accountNumber.slice(-4)}`
}

/** A free referral code from a name: `asha-k`, else `asha-k2`, `asha-k3`... */
async function freeCode(tx: StoreTx, storeId: string, wanted: string): Promise<string> {
  const base = (slugify(wanted).slice(0, 24).replace(/-+$/, '') || 'partner').padEnd(3, '0')
  for (let n = 1; n < 500; n++) {
    const code = n === 1 ? base : `${base}${n}`
    const [taken] = await tx
      .select({ id: affiliate.id })
      .from(affiliate)
      .where(and(eq(affiliate.storeId, storeId), eq(affiliate.code, code)))
    if (!taken) return code
  }
  return `${base}-${crypto.randomUUID().slice(0, 6)}`
}

export type ApplyInput = {
  customerId: string | null
  email: string | null
  phone: string | null
  name: string
  social: string
  message: string
  /** The program they join; none means the store's default program. */
  programId?: string | null | undefined
}

/**
 * A shopper applies (or the merchant adds someone). One affiliate per customer account: a
 * second application returns the first. `settings` are the store's with the chosen program's
 * rules on top (`withProgramRules`); an auto-approve program approves at once.
 */
export async function applyAsAffiliate(
  tx: StoreTx,
  storeId: string,
  input: ApplyInput,
  settings: AffiliateSettings,
  secret: string,
): Promise<AffiliateRow> {
  if (!settings.active) throw new AffiliateError('AFFILIATES_CLOSED', 'The program is not open')
  if (input.customerId) {
    const [existing] = await tx
      .select()
      .from(affiliate)
      .where(and(eq(affiliate.storeId, storeId), eq(affiliate.customerId, input.customerId)))
    if (existing) return existing
  }
  const program = input.programId
    ? await getProgram(tx, input.programId)
    : await defaultProgram(tx, storeId)
  if (!program || program.archivedAt) {
    throw new AffiliateError('PROGRAM_NOT_FOUND', 'Program not found')
  }
  const key = phoneKey(input.phone)
  const [row] = await tx
    .insert(affiliate)
    .values({
      storeId,
      customerId: input.customerId,
      programId: program.id,
      code: await freeCode(tx, storeId, input.name || input.email?.split('@')[0] || 'partner'),
      name: input.name.trim().slice(0, 120),
      email: input.email?.trim().toLowerCase() || null,
      phoneIndex: key ? phoneBlindIndex(key, secret) : null,
      social: input.social.trim().slice(0, 200),
      message: input.message.trim().slice(0, 2000),
    })
    .returning()
  if (!row) throw new AffiliateError('AFFILIATE_NOT_SAVED', 'Affiliate not saved')
  return settings.approval === 'auto' ? approveAffiliate(tx, storeId, row.id) : row
}

/** The affiliate's personal code in the discount engine; made once, never twice. */
async function ensureCoupon(
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
  const [next] = await tx
    .update(affiliate)
    .set({ discountId: made.id, couponCode: code, updatedAt: new Date() })
    .where(eq(affiliate.id, row.id))
    .returning()
  return next ?? row
}

/**
 * Approves an affiliate: makes their code (at their program's discount) and emails them
 * (outbox, same transaction).
 */
export async function approveAffiliate(
  tx: StoreTx,
  storeId: string,
  id: string,
): Promise<AffiliateRow> {
  const [row] = await tx
    .update(affiliate)
    .set({ status: 'approved', approvedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(affiliate.id, id), sql`${affiliate.status} <> 'approved'`))
    .returning()
  if (!row) {
    const current = await getAffiliate(tx, id)
    if (!current) throw new AffiliateError('AFFILIATE_NOT_FOUND', 'Affiliate not found')
    return current
  }
  const program = await programOf(tx, storeId, row)
  const withCoupon = await ensureCoupon(tx, storeId, row, program.rules.coupon)
  if (withCoupon.discountId) {
    await tx
      .update(discount)
      .set({ status: 'active', updatedAt: new Date() })
      .where(eq(discount.id, withCoupon.discountId))
  }
  await insertOutboxEvent(tx, storeId, 'affiliate.approved', { affiliateId: row.id })
  return withCoupon
}

/** Rejects or suspends; a suspended affiliate's code stops working, earned money stays. */
export async function setAffiliateStatus(
  tx: StoreTx,
  id: string,
  status: Extract<AffiliateStatus, 'rejected' | 'suspended'>,
): Promise<AffiliateRow> {
  const [row] = await tx
    .update(affiliate)
    .set({ status, updatedAt: new Date() })
    .where(eq(affiliate.id, id))
    .returning()
  if (!row) throw new AffiliateError('AFFILIATE_NOT_FOUND', 'Affiliate not found')
  if (row.discountId) {
    await tx
      .update(discount)
      .set({ status: 'disabled', updatedAt: new Date() })
      .where(eq(discount.id, row.discountId))
  }
  return row
}

export async function updateAffiliateNote(tx: StoreTx, id: string, note: string): Promise<void> {
  await tx
    .update(affiliate)
    .set({ note: note.slice(0, 2000), updatedAt: new Date() })
    .where(eq(affiliate.id, id))
}

export async function getAffiliate(tx: StoreTx, id: string): Promise<AffiliateRow | null> {
  const [row] = await tx.select().from(affiliate).where(eq(affiliate.id, id))
  return row ?? null
}

export async function affiliateForCustomer(
  tx: StoreTx,
  storeId: string,
  customerId: string,
): Promise<AffiliateRow | null> {
  const [row] = await tx
    .select()
    .from(affiliate)
    .where(and(eq(affiliate.storeId, storeId), eq(affiliate.customerId, customerId)))
  return row ?? null
}

/** Newest first; the admin list filters and pages in the browser, like Forms. */
export function listAffiliates(tx: StoreTx, limit = 1000): Promise<AffiliateRow[]> {
  return tx.select().from(affiliate).orderBy(desc(affiliate.createdAt)).limit(limit)
}

/** Counts a click on an approved affiliate's link. Unknown or paused codes count nothing. */
export async function recordAffiliateClick(
  tx: StoreTx,
  storeId: string,
  code: string,
): Promise<boolean> {
  const rows = await tx
    .update(affiliate)
    .set({ clicks: sql`${affiliate.clicks} + 1` })
    .where(
      and(
        eq(affiliate.storeId, storeId),
        eq(affiliate.code, code),
        eq(affiliate.status, 'approved'),
      ),
    )
    .returning({ id: affiliate.id })
  return rows.length > 0
}

/** Encrypts and saves how the affiliate wants to be paid. Only the masked hint is readable. */
export async function savePayoutDetails(
  tx: StoreTx,
  id: string,
  details: PayoutDetails,
  secret: string,
): Promise<{ hint: string; hasPan: boolean }> {
  const parsed = PayoutDetailsSchema.parse(details)
  const hint = payoutHint(parsed)
  await tx
    .update(affiliate)
    .set({
      payoutMethod: parsed.method,
      payoutDetails: encryptSecret(JSON.stringify(parsed), secret),
      payoutHint: hint,
      hasPan: Boolean(parsed.pan),
      updatedAt: new Date(),
    })
    .where(eq(affiliate.id, id))
  return { hint, hasPan: Boolean(parsed.pan) }
}

/** Decrypts payout details for the bank file. Null when none were saved or the key is gone. */
export function readPayoutDetails(
  row: Pick<AffiliateRow, 'payoutDetails'>,
  secret: string,
): PayoutDetails | null {
  if (!row.payoutDetails) return null
  try {
    const parsed = PayoutDetailsSchema.safeParse(
      JSON.parse(decryptSecret(row.payoutDetails, secret)),
    )
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}
