import { randomBytes } from 'node:crypto'
import { CommerceError, insertOutboxEvent } from '@commerce/core'
import { type StoreTx, variant } from '@commerce/db'
import { and, eq, inArray, isNull, or, sql } from 'drizzle-orm'
import { variantIsEligible } from './eligibility'
import { backInStockSignup, type SignupStatus } from './schema'

export class BackInStockError extends CommerceError {}

const newToken = () => randomBytes(24).toString('base64url')

export type SignupInput = {
  variantId: string
  email?: string | undefined
  phone?: string | undefined
  ip?: string | undefined
}

const normaliseEmail = (email: string): string => email.trim().toLowerCase()
const normalisePhone = (phone: string): string => phone.replace(/[^0-9]/g, '')

/**
 * Register a "notify me" signup. Dedupe is enforced at the database (the two
 * partial unique indexes on `back_in_stock_signup`); a repeat signup for the
 * same still-live contact/variant is a no-op that returns the existing row,
 * not an error, so a shopper double-submitting a form is silently fine. Email
 * signups start `pending_confirmation` (double opt-in); WhatsApp has no such
 * step and starts `confirmed` straight away, since the number itself was
 * typed by the shopper and every message we send carries an unsubscribe link. A new email
 * signup queues its confirm message (`back_in_stock.confirm_requested`, see `messages.ts`).
 */
export async function createSignup(tx: StoreTx, storeId: string, input: SignupInput) {
  const email = input.email ? normaliseEmail(input.email) : null
  const phone = input.phone ? normalisePhone(input.phone) : null
  if (!email && !phone) {
    throw new BackInStockError('invalid', 'An email or a WhatsApp number is required')
  }

  const [v] = await tx
    .select({ id: variant.id, productId: variant.productId })
    .from(variant)
    .where(eq(variant.id, input.variantId))
  if (!v) throw new BackInStockError('not_found', 'Variant not found')
  if (!(await variantIsEligible(tx, input.variantId))) {
    throw new BackInStockError(
      'preorder',
      'This variant is on pre-order and is always purchasable, so it has no back-in-stock alert',
    )
  }

  const existing = await tx
    .select()
    .from(backInStockSignup)
    .where(
      and(
        eq(backInStockSignup.storeId, storeId),
        eq(backInStockSignup.variantId, input.variantId),
        or(
          email ? eq(backInStockSignup.email, email) : undefined,
          phone ? eq(backInStockSignup.phone, phone) : undefined,
        ),
      ),
    )
  // Only a *live* prior signup (not unsubscribed) counts as a duplicate.
  const live = existing.find((r) => r.status !== 'unsubscribed')
  if (live) return { row: live, created: false }

  const status: SignupStatus = email ? 'pending_confirmation' : 'confirmed'
  const now = new Date()
  const [row] = await tx
    .insert(backInStockSignup)
    .values({
      storeId,
      variantId: input.variantId,
      productId: v.productId,
      email,
      phone,
      status,
      consentAt: now,
      ip: input.ip ?? null,
      confirmToken: email ? newToken() : null,
      unsubscribeToken: newToken(),
    })
    .onConflictDoNothing()
    .returning()
  if (row) {
    // Double opt-in: the confirm link goes out through the outbox, in this same transaction.
    if (email) {
      await insertOutboxEvent(tx, storeId, 'back_in_stock.confirm_requested', {
        backInStockSignupId: row.id,
      })
    }
    return { row, created: true }
  }

  // Raced with a concurrent identical signup: the unique index won, fetch what landed.
  const [again] = await tx
    .select()
    .from(backInStockSignup)
    .where(
      and(
        eq(backInStockSignup.storeId, storeId),
        eq(backInStockSignup.variantId, input.variantId),
        email ? eq(backInStockSignup.email, email) : eq(backInStockSignup.phone, phone as string),
      ),
    )
  if (!again) throw new BackInStockError('race', 'Signup could not be created')
  return { row: again, created: false }
}

/** Double opt-in: the confirm link's token turns `pending_confirmation` into `confirmed`. */
export async function confirmSignup(tx: StoreTx, token: string) {
  const [row] = await tx
    .select()
    .from(backInStockSignup)
    .where(and(eq(backInStockSignup.confirmToken, token), isNull(backInStockSignup.confirmedAt)))
  if (!row) return null
  if (row.status !== 'pending_confirmation') return row
  const [updated] = await tx
    .update(backInStockSignup)
    .set({
      status: 'confirmed',
      confirmedAt: new Date(),
      confirmToken: null,
      updatedAt: new Date(),
    })
    .where(eq(backInStockSignup.id, row.id))
    .returning()
  return updated ?? row
}

/** Every signup's unsubscribe token works forever, per message, regardless of status. */
export async function unsubscribeByToken(tx: StoreTx, token: string) {
  const [row] = await tx
    .select()
    .from(backInStockSignup)
    .where(eq(backInStockSignup.unsubscribeToken, token))
  if (!row) return null
  if (row.status === 'unsubscribed') return row
  const [updated] = await tx
    .update(backInStockSignup)
    .set({ status: 'unsubscribed', unsubscribedAt: new Date(), updatedAt: new Date() })
    .where(eq(backInStockSignup.id, row.id))
    .returning()
  return updated ?? row
}

export type SignupListFilter = { variantId?: string | undefined; status?: SignupStatus | undefined }

/** Masked contact for the admin list: `k***@example.com` / `98****3210`. */
export function maskContact(email: string | null, phone: string | null): string {
  if (email) {
    const [user = '', domain = ''] = email.split('@')
    const head = user.slice(0, 1)
    return `${head}${'*'.repeat(Math.max(1, user.length - 1))}@${domain}`
  }
  if (phone) {
    return phone.length <= 4
      ? phone
      : `${phone.slice(0, 2)}${'*'.repeat(phone.length - 4)}${phone.slice(-2)}`
  }
  return ''
}

export async function listSignups(tx: StoreTx, storeId: string, filter: SignupListFilter = {}) {
  const conds = [
    eq(backInStockSignup.storeId, storeId),
    filter.variantId ? eq(backInStockSignup.variantId, filter.variantId) : undefined,
    filter.status ? eq(backInStockSignup.status, filter.status) : undefined,
  ]
  return tx
    .select()
    .from(backInStockSignup)
    .where(and(...conds))
    .orderBy(backInStockSignup.createdAt)
}

/** Waiting-list demand signal: confirmed-or-pending signups per variant, most-waited first. */
export async function topVariantsByWaiting(tx: StoreTx, storeId: string, limit = 10) {
  const rows = await tx
    .select()
    .from(backInStockSignup)
    .where(
      and(
        eq(backInStockSignup.storeId, storeId),
        or(
          eq(backInStockSignup.status, 'confirmed'),
          eq(backInStockSignup.status, 'pending_confirmation'),
        ),
      ),
    )
  const counts = new Map<string, { variantId: string; productId: string; waiting: number }>()
  for (const r of rows) {
    const entry = counts.get(r.variantId) ?? {
      variantId: r.variantId,
      productId: r.productId,
      waiting: 0,
    }
    entry.waiting += 1
    counts.set(r.variantId, entry)
  }
  return [...counts.values()].sort((a, b) => b.waiting - a.waiting).slice(0, limit)
}

/**
 * How many shoppers are waiting (confirmed or pending confirmation) and on how many variants,
 * in one statement over the store/variant/status index. The app bar's "N shoppers waiting on
 * M variants".
 */
export async function waitingSummary(
  tx: StoreTx,
  storeId: string,
): Promise<{ shoppers: number; variants: number }> {
  const [row] = await tx
    .select({
      shoppers: sql<number>`count(*)::int`,
      variants: sql<number>`count(distinct ${backInStockSignup.variantId})::int`,
    })
    .from(backInStockSignup)
    .where(
      and(
        eq(backInStockSignup.storeId, storeId),
        inArray(backInStockSignup.status, ['confirmed', 'pending_confirmation']),
      ),
    )
  return { shoppers: row?.shoppers ?? 0, variants: row?.variants ?? 0 }
}
