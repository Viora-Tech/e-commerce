/** SOURCE OF TRUTH: "Sign in as customer" — WHAT: the single-use `staff_sign_in` login ticket a staff member mints on the customer page, its redemption on the store's domain into a one-hour session that records who signed in (`impersonated_by`), and the timeline note on the customer / WHY: staff see exactly what a shopper sees (cart, orders, addresses) without asking for their code, and the shopper's history always says who did it */

import { customer, customerLoginTicket, customerNote } from '@commerce/db'
import { and, eq, isNull, lt } from 'drizzle-orm'
import { startCustomerSession } from '../accounts/auth'
import type { StoreContext } from '../context'
import { randomToken, sha256Hex } from './tokens'

/*
 * Modelled on Better Auth's admin-plugin impersonation (a session that records
 * `impersonatedBy` and lasts an hour), on our own tables: shoppers are per-store customers
 * under RLS with their own sessions, while Better Auth's tables hold merchant staff.
 *
 * It reuses the login ticket table and the magic link's shape (a random token, only its hash
 * stored, deleted in the statement that reads it) rather than the provider hand-off: a
 * hand-off is bound to the browser that started the sign-in on the store's domain, and here
 * the admin tab starts it on another domain, so there is no store-domain cookie to bind to.
 * What keeps it safe instead: the token is minted only for a member holding
 * `customers.sign_in_as`, is good for 2 minutes, works once, only under this store's RLS, and
 * the admin opens it straight away in a new tab.
 */

/** The ticket is followed by a redirect straight away, like a hand-off. */
export const STAFF_SIGN_IN_TTL_MS = 2 * 60 * 1000
/** A signed-in-as session ends after an hour, like Better Auth's impersonation default. */
export const STAFF_SESSION_TTL_MS = 60 * 60 * 1000
/** The store-domain route that spends the ticket (`?token=`). */
export const STAFF_SIGN_IN_PATH = '/account/login/staff'

/** The timeline line on the customer. Stored as written, like the WhatsApp chat note. */
export const staffSignInNote = (staffName: string): string =>
  `${staffName} signed in to the store as this customer from the admin.`

export type StaffSignInMint =
  | { ok: true; token: string; customerName: string | null }
  | { ok: false; reason: 'not_found' | 'unavailable' }

/**
 * Mint the hand-off for `customerId`, on behalf of `staff` (the caller checked the
 * permission), and note it on the customer's timeline.
 */
export async function mintStaffSignIn(
  ctx: StoreContext,
  input: { customerId: string; staff: { userId: string; name: string; email: string | null } },
  now: Date = new Date(),
): Promise<StaffSignInMint> {
  const [cu] = await ctx.tx
    .select({
      id: customer.id,
      name: customer.name,
      email: customer.email,
      anonymisedAt: customer.anonymisedAt,
      mergedIntoId: customer.mergedIntoId,
    })
    .from(customer)
    .where(eq(customer.id, input.customerId))
  if (!cu) return { ok: false, reason: 'not_found' }
  // An erased or merged record has nobody left to be.
  if (cu.anonymisedAt || cu.mergedIntoId) return { ok: false, reason: 'unavailable' }
  const token = randomToken()
  await ctx.tx.insert(customerLoginTicket).values({
    storeId: ctx.storeId,
    kind: 'staff_sign_in',
    tokenHash: sha256Hex(token),
    status: 'ready',
    customerId: cu.id,
    impersonatedBy: input.staff.userId,
    nextPath: '/account',
    expiresAt: new Date(now.getTime() + STAFF_SIGN_IN_TTL_MS),
    createdAt: now,
  })
  // Housekeeping: this store's dead tickets go with each new one.
  await ctx.tx.delete(customerLoginTicket).where(lt(customerLoginTicket.expiresAt, now))
  await ctx.tx.insert(customerNote).values({
    storeId: ctx.storeId,
    customerId: cu.id,
    body: staffSignInNote(input.staff.name || input.staff.email || 'A staff member'),
    author: input.staff.email,
    createdAt: now,
  })
  return { ok: true, token, customerName: cu.name ?? cu.email }
}

export type StaffSignInRedeem =
  | { ok: true; customerId: string; token: string; expiresAt: Date; impersonatedBy: string }
  | { ok: false; reason: 'invalid' | 'expired' }

const TOKEN = /^[A-Za-z0-9_-]{40,60}$/

/**
 * Spend the ticket on the store's domain and start the one-hour session that records who
 * signed in. A second use, another store's token or an expired one signs nobody in.
 */
export async function redeemStaffSignIn(
  ctx: StoreContext,
  token: unknown,
  now: Date = new Date(),
): Promise<StaffSignInRedeem> {
  if (typeof token !== 'string' || !TOKEN.test(token)) return { ok: false, reason: 'invalid' }
  const [row] = await ctx.tx
    .delete(customerLoginTicket)
    .where(
      and(
        eq(customerLoginTicket.tokenHash, sha256Hex(token)),
        eq(customerLoginTicket.kind, 'staff_sign_in'),
      ),
    )
    .returning()
  if (!row?.customerId || !row.impersonatedBy) return { ok: false, reason: 'invalid' }
  if (row.expiresAt.getTime() <= now.getTime()) return { ok: false, reason: 'expired' }
  const [cu] = await ctx.tx
    .select({ id: customer.id })
    .from(customer)
    .where(
      and(
        eq(customer.id, row.customerId),
        isNull(customer.anonymisedAt),
        isNull(customer.mergedIntoId),
      ),
    )
  if (!cu) return { ok: false, reason: 'invalid' }
  const session = await startCustomerSession(
    ctx,
    cu.id,
    now,
    STAFF_SESSION_TTL_MS,
    row.impersonatedBy,
  )
  return {
    ok: true,
    customerId: cu.id,
    token: session.token,
    expiresAt: session.expiresAt,
    impersonatedBy: row.impersonatedBy,
  }
}
