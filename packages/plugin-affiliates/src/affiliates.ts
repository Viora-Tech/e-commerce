/** SOURCE OF TRUTH: affiliates — WHAT: signup, approval, coupon codes, clicks and encrypted payout details / WHY: the admin and the storefront portal share every rule */
import { decryptSecret, encryptSecret, insertOutboxEvent, phoneBlindIndex } from '@commerce/core'
import { slugify } from '@commerce/core/catalog'
import { validateGstin } from '@commerce/core/gstin'
import { discount, type StoreTx } from '@commerce/db'
import { and, desc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { blockedKinds, fraudIndex, payoutKeys, refreshReview } from './blocklist'
import { ensureCoupon, linkCodeIs, recordCode } from './codes'
import { phoneKey } from './fraud'
import { defaultProgram, getProgram, programOf } from './programs'
import { affiliate } from './schema'
import type { AffiliateSettings, AffiliateStatus } from './settings'
import { AffiliateError } from './store-settings'

export type AffiliateRow = typeof affiliate.$inferSelect

const Gstin = z
  .string()
  .trim()
  .toUpperCase()
  .refine((v) => validateGstin(v).ok, 'Enter a valid 15-character GSTIN')
  .optional()

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
    /** GST-registered affiliates add their GSTIN; GST is then added to their payouts. */
    gstin: Gstin,
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
    gstin: Gstin,
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
      .where(and(eq(affiliate.storeId, storeId), linkCodeIs(code)))
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
  /** How they joined; `applied` unless the merchant added them or a buyer tapped Share and earn. */
  source?: AffiliateRow['source'] | undefined
  /** The IP a storefront application came from, for the blocklist. */
  ip?: string | null | undefined
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
  const domain = input.email?.split('@')[1] ?? null
  const blocked = await blockedKinds(tx, secret, {
    email: input.email,
    email_domain: domain,
    ip: input.ip,
    phone: input.phone,
  })
  if (blocked.has('email') || blocked.has('email_domain') || blocked.has('ip')) {
    throw new AffiliateError('AFFILIATE_BLOCKED', 'This application cannot be accepted')
  }
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
      source: input.source ?? 'applied',
      signupIpIndex: input.ip ? fraudIndex('ip', input.ip.trim().toLowerCase(), secret) : null,
      // A blocked phone does not refuse the signup: the merchant reviews before any payout.
      reviewReasons: blocked.has('phone') ? ['blocked_phone'] : [],
    })
    .returning()
  if (!row) throw new AffiliateError('AFFILIATE_NOT_SAVED', 'Affiliate not saved')
  await recordCode(tx, storeId, row.id, 'link', row.code)
  return settings.approval === 'auto' ? approveAffiliate(tx, storeId, row.id) : row
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
    .where(and(eq(affiliate.storeId, storeId), linkCodeIs(code), eq(affiliate.status, 'approved')))
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
  const keys = payoutKeys(parsed)
  const [row] = await tx
    .update(affiliate)
    .set({
      payoutMethod: parsed.method,
      payoutDetails: encryptSecret(JSON.stringify(parsed), secret),
      payoutHint: hint,
      hasPan: Boolean(parsed.pan),
      gstRegistered: Boolean(parsed.gstin),
      panIndex: keys.pan ? fraudIndex('pan', keys.pan, secret) : null,
      payeeIndex: keys.payee ? fraudIndex('payee', keys.payee, secret) : null,
      updatedAt: new Date(),
    })
    .where(eq(affiliate.id, id))
    .returning()
  // A PAN or payee another affiliate uses, or one on the blocklist, holds payouts for review.
  if (row) await refreshReview(tx, row, keys, secret)
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
