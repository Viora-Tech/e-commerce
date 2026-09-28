import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'
import { customer, customerLoginCode, customerSession } from '@commerce/db'
import { and, eq, gt, isNull, lt } from 'drizzle-orm'
import { z } from 'zod'
import type { StoreContext } from '../context'
import { decryptCustomerPhone } from '../customers/phone-crypto'
import { normaliseMobile } from './schemas'

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
/**
 * Wrong guesses count for this long across resends: a new code does not hand out five
 * fresh guesses, or requesting one every 30 seconds would allow unlimited guessing.
 */
const LOGIN_CODE_ATTEMPT_WINDOW_MS = 60 * 60 * 1000

/** Wrong guesses a newly minted code inherits from the one it replaces. */
export function attemptsCarriedOver(
  existing: { createdAt: Date; attempts: number } | undefined,
  now: Date,
): number {
  if (!existing) return 0
  return now.getTime() - existing.createdAt.getTime() < LOGIN_CODE_ATTEMPT_WINDOW_MS
    ? existing.attempts
    : 0
}
export const CUSTOMER_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000

const Email = z.string().trim().toLowerCase().email().max(254)

export const normaliseLoginEmail = (raw: unknown): string | null => {
  const parsed = Email.safeParse(raw)
  return parsed.success ? parsed.data : null
}

/**
 * The rate-limit key for sending or checking a sign-in code: per store, on the same
 * normalised address the code is stored under, so `" A@b.com"` and `"a@b.com"`, or
 * `"+91 98765 43210"` and `"09876543210"`, share one bucket instead of each getting its own.
 * One store's limit never locks the same shopper out of another store either.
 */
export function otpLimiterId(storeId: string, kind: 'email' | 'phone', raw: unknown): string {
  const text = typeof raw === 'string' ? raw : ''
  const normalised = kind === 'email' ? normaliseLoginEmail(text) : normaliseMobile(text)
  return `${storeId}:${normalised ?? text.replace(/\s/g, '').toLowerCase()}`
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
    .select({ createdAt: customerLoginCode.createdAt, attempts: customerLoginCode.attempts })
    .from(customerLoginCode)
    .where(eq(customerLoginCode.email, email))
  if (existing && now.getTime() - existing.createdAt.getTime() < LOGIN_CODE_RESEND_MS) {
    return { ok: false, reason: 'too_soon' }
  }
  const attempts = attemptsCarriedOver(existing, now)
  if (attempts >= LOGIN_CODE_MAX_ATTEMPTS) return { ok: false, reason: 'too_soon' }
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
  const values = {
    codeHash: hashCode(ctx.storeId, email, code),
    attempts,
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
  /** Session length; see `sessionLifetime` ("Remember this device"). */
  ttlMs: number = CUSTOMER_SESSION_TTL_MS,
): Promise<VerifyCodeResult> {
  const email = normaliseLoginEmail(rawEmail)
  const code = typeof rawCode === 'string' ? rawCode.replace(/\s/g, '') : ''
  if (!email || !/^\d{6}$/.test(code)) return { ok: false, reason: 'invalid' }
  // Locked, so parallel guesses queue here and each sees the count the last one wrote.
  const [row] = await ctx.tx
    .select()
    .from(customerLoginCode)
    .where(eq(customerLoginCode.email, email))
    .for('update')
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
  return startCustomerSession(ctx, cu?.id as string, now, ttlMs)
}

/**
 * Mint a session for a customer who just proved who they are (a code, a magic
 * link, a passkey or a provider sign-in). Only the token's hash is stored; the
 * token goes in the cookie.
 */
export async function startCustomerSession(
  ctx: StoreContext,
  customerId: string,
  now: Date = new Date(),
  ttlMs: number = CUSTOMER_SESSION_TTL_MS,
): Promise<{ ok: true; token: string; customerId: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(now.getTime() + ttlMs)
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

/** End every session a customer has, on every device (account deletion). */
export async function revokeAllCustomerSessions(
  ctx: StoreContext,
  customerId: string,
): Promise<number> {
  const rows = await ctx.tx
    .delete(customerSession)
    .where(eq(customerSession.customerId, customerId))
    .returning({ id: customerSession.id })
  return rows.length
}

export type SignedInCustomer = {
  id: string
  /** Null for a shopper who signs in with their mobile number and never gave an email. */
  email: string | null
  name: string | null
  phone: string | null
  acceptsMarketing: boolean
  acceptsWhatsapp: boolean
  acceptsSms: boolean
}

const TOKEN = /^[A-Za-z0-9_-]{20,100}$/

/** The customer a session token belongs to on this store, or null. */
export async function customerForSession(
  ctx: StoreContext,
  token: string | null | undefined,
  secret: string,
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
      acceptsWhatsapp: customer.acceptsWhatsapp,
      acceptsSms: customer.acceptsSms,
    })
    .from(customerSession)
    .innerJoin(customer, eq(customer.id, customerSession.customerId))
    .where(
      and(
        eq(customerSession.tokenHash, hashSessionToken(token)),
        gt(customerSession.expiresAt, now),
        isNull(customer.anonymisedAt),
      ),
    )
  if (!row) return null
  const phone = decryptCustomerPhone(row.phone, secret)
  // A session needs something to know the shopper by.
  if (!row.email && !phone) return null
  return { ...row, phone }
}

/** Sign out: the token stops working immediately. */
export async function revokeCustomerSession(ctx: StoreContext, token: string): Promise<void> {
  if (!TOKEN.test(token)) return
  await ctx.tx.delete(customerSession).where(eq(customerSession.tokenHash, hashSessionToken(token)))
}
