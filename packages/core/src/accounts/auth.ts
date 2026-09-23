import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'
import { customer, customerLoginCode, customerSession } from '@commerce/db'
import { and, eq, gt, lt } from 'drizzle-orm'
import { z } from 'zod'
import type { StoreContext } from '../context'

/**
 * Storefront shopper sign-in: a six digit code by email, then an opaque session
 * token in a cookie. Deliberately separate from Better Auth (merchant staff): every
 * row here carries `store_id` and sits under RLS, so a code or a session minted on
 * one store means nothing on another. Only hashes are stored.
 */

export const LOGIN_CODE_TTL_MS = 10 * 60 * 1000
export const LOGIN_CODE_MAX_ATTEMPTS = 5
/** A new code for the same email is refused inside this window, so the form cannot spam an inbox. */
export const LOGIN_CODE_RESEND_MS = 30 * 1000
export const CUSTOMER_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000

const Email = z.string().trim().toLowerCase().email().max(254)

export const normaliseLoginEmail = (raw: unknown): string | null => {
  const parsed = Email.safeParse(raw)
  return parsed.success ? parsed.data : null
}

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex')

/** The code hash binds store and email, so a leaked hash cannot be replayed elsewhere. */
const hashCode = (storeId: string, email: string, code: string): string =>
  sha256(`${storeId}:${email}:${code}`)

export const hashSessionToken = (token: string): string => sha256(token)

export type RequestCodeResult =
  | { ok: true; email: string; code: string }
  | { ok: false; reason: 'invalid_email' | 'too_soon' }

/**
 * Mint a login code for an email. Works for emails that are not customers yet:
 * like Shopify, signing in creates the account. The caller delivers the code.
 */
export async function requestLoginCode(
  ctx: StoreContext,
  rawEmail: unknown,
  now: Date = new Date(),
): Promise<RequestCodeResult> {
  const email = normaliseLoginEmail(rawEmail)
  if (!email) return { ok: false, reason: 'invalid_email' }
  const [existing] = await ctx.tx
    .select({ createdAt: customerLoginCode.createdAt })
    .from(customerLoginCode)
    .where(eq(customerLoginCode.email, email))
  if (existing && now.getTime() - existing.createdAt.getTime() < LOGIN_CODE_RESEND_MS) {
    return { ok: false, reason: 'too_soon' }
  }
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
  const values = {
    codeHash: hashCode(ctx.storeId, email, code),
    attempts: 0,
    expiresAt: new Date(now.getTime() + LOGIN_CODE_TTL_MS),
    createdAt: now,
  }
  await ctx.tx
    .insert(customerLoginCode)
    .values({ storeId: ctx.storeId, email, ...values })
    .onConflictDoUpdate({
      target: [customerLoginCode.storeId, customerLoginCode.email],
      set: values,
    })
  return { ok: true, email, code }
}

export type VerifyCodeResult =
  | { ok: true; token: string; customerId: string; expiresAt: Date }
  | { ok: false; reason: 'invalid' | 'expired' | 'locked' }

/**
 * Check a code; on success the code is spent, the customer row for that email is
 * found or created, and a session token is returned (only its hash is stored).
 */
export async function verifyLoginCode(
  ctx: StoreContext,
  rawEmail: unknown,
  rawCode: unknown,
  now: Date = new Date(),
): Promise<VerifyCodeResult> {
  const email = normaliseLoginEmail(rawEmail)
  const code = typeof rawCode === 'string' ? rawCode.replace(/\s/g, '') : ''
  if (!email || !/^\d{6}$/.test(code)) return { ok: false, reason: 'invalid' }
  const [row] = await ctx.tx
    .select()
    .from(customerLoginCode)
    .where(eq(customerLoginCode.email, email))
  if (!row) return { ok: false, reason: 'invalid' }
  if (row.expiresAt.getTime() <= now.getTime()) return { ok: false, reason: 'expired' }
  if (row.attempts >= LOGIN_CODE_MAX_ATTEMPTS) return { ok: false, reason: 'locked' }

  const expected = Buffer.from(row.codeHash, 'hex')
  const given = Buffer.from(hashCode(ctx.storeId, email, code), 'hex')
  if (!timingSafeEqual(expected, given)) {
    await ctx.tx
      .update(customerLoginCode)
      .set({ attempts: row.attempts + 1 })
      .where(eq(customerLoginCode.id, row.id))
    return { ok: false, reason: row.attempts + 1 >= LOGIN_CODE_MAX_ATTEMPTS ? 'locked' : 'invalid' }
  }

  await ctx.tx.delete(customerLoginCode).where(eq(customerLoginCode.id, row.id))
  const [cu] = await ctx.tx
    .insert(customer)
    .values({ storeId: ctx.storeId, email })
    .onConflictDoUpdate({
      target: [customer.storeId, customer.email],
      set: { updatedAt: now },
    })
    .returning({ id: customer.id })
  const customerId = cu?.id as string
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(now.getTime() + CUSTOMER_SESSION_TTL_MS)
  await ctx.tx.insert(customerSession).values({
    storeId: ctx.storeId,
    customerId,
    tokenHash: hashSessionToken(token),
    expiresAt,
    createdAt: now,
  })
  // Housekeeping: this customer's dead sessions go with each new sign-in.
  await ctx.tx
    .delete(customerSession)
    .where(and(eq(customerSession.customerId, customerId), lt(customerSession.expiresAt, now)))
  return { ok: true, token, customerId, expiresAt }
}

export type SignedInCustomer = {
  id: string
  email: string
  name: string | null
  phone: string | null
  acceptsMarketing: boolean
}

const TOKEN = /^[A-Za-z0-9_-]{20,100}$/

/** The customer a session token belongs to on this store, or null. */
export async function customerForSession(
  ctx: StoreContext,
  token: string | null | undefined,
  now: Date = new Date(),
): Promise<SignedInCustomer | null> {
  if (!token || !TOKEN.test(token)) return null
  const [row] = await ctx.tx
    .select({
      id: customer.id,
      email: customer.email,
      name: customer.name,
      phone: customer.phone,
      acceptsMarketing: customer.acceptsMarketing,
    })
    .from(customerSession)
    .innerJoin(customer, eq(customer.id, customerSession.customerId))
    .where(
      and(
        eq(customerSession.tokenHash, hashSessionToken(token)),
        gt(customerSession.expiresAt, now),
      ),
    )
  if (!row?.email) return null
  return { ...row, email: row.email }
}

/** Sign out: the token stops working immediately. */
export async function revokeCustomerSession(ctx: StoreContext, token: string): Promise<void> {
  if (!TOKEN.test(token)) return
  await ctx.tx.delete(customerSession).where(eq(customerSession.tokenHash, hashSessionToken(token)))
}
