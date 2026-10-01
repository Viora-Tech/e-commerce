import { customer, newsletterSignup, type StoreTx } from '@commerce/db'
import { and, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { insertOutboxEvent } from '../outbox/write'
import { setMarketingConsent } from '../privacy/marketing-consent'
import { openToken, signToken } from '../shopper-login/tokens'

const Email = z.string().trim().toLowerCase().email().max(254)

/** Tag the storefront signup adds, so the merchant can segment signups from buyers. */
export const NEWSLETTER_TAG = 'newsletter'

/** A confirm link works for a week; signing up again sends a new one. */
const CONFIRM_TTL_MS = 7 * 24 * 60 * 60 * 1000
/** Signing up again within this long sends no second email (an inbox is not a target). */
const RESEND_AFTER_MS = 2 * 60 * 1000

/**
 * Give an address newsletter consent: the shopper becomes (or stays) a customer who
 * accepted email marketing and carries the newsletter tag, as Shopify's newsletter form
 * does. Only for an address that proved it is the shopper's: the confirm link (double
 * opt-in, security audit D-09). Returns the customer id, or null for an invalid email.
 */
async function grantNewsletterConsent(
  tx: StoreTx,
  storeId: string,
  rawEmail: unknown,
  now: Date = new Date(),
): Promise<string | null> {
  const parsed = Email.safeParse(rawEmail)
  if (!parsed.success) return null
  const [row] = await tx
    .insert(customer)
    .values({ storeId, email: parsed.data, tags: [NEWSLETTER_TAG] })
    .onConflictDoUpdate({
      target: [customer.storeId, customer.email],
      set: {
        tags: sql`case when ${NEWSLETTER_TAG} = any(${customer.tags}) then ${customer.tags} else array_append(${customer.tags}, ${NEWSLETTER_TAG}) end`,
        updatedAt: now,
      },
    })
    .returning({ id: customer.id })
  if (!row) return null
  // Consent is recorded with its time and source; signing up again after an
  // unsubscribe is a fresh opt in, so the unsubscribe is cleared.
  await setMarketingConsent(
    { tx, storeId },
    {
      customerId: row.id,
      channel: 'email',
      granted: true,
      source: 'newsletter',
      actor: { type: 'customer' },
      at: now,
    },
  )
  return row.id
}

export type NewsletterSignupResult = 'sent' | 'already_sent' | 'invalid'

/**
 * The storefront's email signup (double opt-in, security audit D-09). Records a pending
 * signup and queues the confirm email through the outbox; nothing is written on a
 * customer and no marketing goes out until the link is opened. Anyone can type anyone's
 * address here, so the address gets one plain confirm email and nothing else.
 */
export async function requestNewsletterSignup(
  tx: StoreTx,
  storeId: string,
  rawEmail: unknown,
  now: Date = new Date(),
): Promise<NewsletterSignupResult> {
  const parsed = Email.safeParse(rawEmail)
  if (!parsed.success) return 'invalid'
  const email = parsed.data
  const [existing] = await tx
    .select()
    .from(newsletterSignup)
    .where(eq(newsletterSignup.email, email))
  if (
    existing?.status === 'pending' &&
    existing.expiresAt.getTime() > now.getTime() &&
    now.getTime() - existing.updatedAt.getTime() < RESEND_AFTER_MS
  ) {
    return 'already_sent'
  }
  const expiresAt = new Date(now.getTime() + CONFIRM_TTL_MS)
  const [row] = await tx
    .insert(newsletterSignup)
    .values({ storeId, email, status: 'pending', expiresAt, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: [newsletterSignup.storeId, newsletterSignup.email],
      set: { status: 'pending', expiresAt, confirmedAt: null, updatedAt: now },
    })
    .returning({ id: newsletterSignup.id })
  if (!row) return 'invalid'
  await insertOutboxEvent(tx, storeId, 'newsletter.confirm_requested', { signupId: row.id })
  return 'sent'
}

type ConfirmPayload = { s: string; i: string; e: number }

/** The signed token in a confirm link: names the store and the signup, expires with it. */
export function newsletterConfirmToken(
  signup: { storeId: string; id: string; expiresAt: Date },
  secret: string,
): string {
  return signToken<ConfirmPayload>(
    { s: signup.storeId, i: signup.id, e: signup.expiresAt.getTime() },
    secret,
    'newsletter',
  )
}

/** `<base>/newsletter/confirm/<token>`, the page that asks the shopper to confirm. */
export const newsletterConfirmUrl = (base: string, token: string): string =>
  `${base.replace(/\/$/, '')}/newsletter/confirm/${token}`

/** The pending signup a confirm link points at, if the link is good for this store. */
export async function newsletterSignupForToken(
  tx: StoreTx,
  storeId: string,
  token: unknown,
  secret: string,
  now: Date = new Date(),
): Promise<{ id: string; email: string; status: 'pending' | 'confirmed' } | null> {
  const opened = openToken<ConfirmPayload>(token, secret, 'newsletter', now)
  if (!opened.ok || opened.payload.s !== storeId) return null
  const [row] = await tx
    .select({
      id: newsletterSignup.id,
      email: newsletterSignup.email,
      status: newsletterSignup.status,
    })
    .from(newsletterSignup)
    .where(eq(newsletterSignup.id, opened.payload.i))
  return row ?? null
}

export type NewsletterConfirmResult =
  | { ok: true; email: string; customerId: string; alreadyConfirmed: boolean }
  | { ok: false }

/**
 * The shopper pressed "Confirm" on the page the link opened (opening the page alone
 * changes nothing, since mail scanners open links). Grants consent once; a second press
 * is a harmless "already confirmed".
 */
export async function confirmNewsletterSignup(
  tx: StoreTx,
  storeId: string,
  token: unknown,
  secret: string,
  now: Date = new Date(),
): Promise<NewsletterConfirmResult> {
  const found = await newsletterSignupForToken(tx, storeId, token, secret, now)
  if (!found) return { ok: false }
  const [claimed] = await tx
    .update(newsletterSignup)
    .set({ status: 'confirmed', confirmedAt: now, updatedAt: now })
    .where(and(eq(newsletterSignup.id, found.id), eq(newsletterSignup.status, 'pending')))
    .returning({ id: newsletterSignup.id })
  if (!claimed) {
    const [c] = await tx
      .select({ id: customer.id })
      .from(customer)
      .where(eq(customer.email, found.email))
    return c
      ? { ok: true, email: found.email, customerId: c.id, alreadyConfirmed: true }
      : { ok: false }
  }
  const customerId = await grantNewsletterConsent(tx, storeId, found.email, now)
  if (!customerId) return { ok: false }
  return { ok: true, email: found.email, customerId, alreadyConfirmed: false }
}
